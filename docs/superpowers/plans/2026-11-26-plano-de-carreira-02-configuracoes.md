# Plano de carreira, PR 2: Configurações → Plano de carreira

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o gestor vê, cria, edita, arquiva e desarquiva as trilhas de carreira em Configurações → Plano de carreira, no editor do mockup A (grade "Níveis e metas" e aba "Regras da trilha"), e a sub-tela `/professores/metas` sai.

**Architecture:** o rascunho da trilha é um conjunto de funções puras em `src/lib/carreira/rascunho.js`; a gravação (`src/lib/carreiraWrites.js`) troca o campo `trilhas.<id>` inteiro pelo caminho do campo. A tela mora em `src/views/settings/carreira/`, montada pela `SettingsView` como a seção `carreira`, só com o módulo `faltosos`. A trilha aberta e a aba dela moram no endereço (`/configuracoes/carreira/<id>` e `/<id>/regras`), lidas no `readScreen` no molde do modelo de rotina. A assinatura de `stronix_config/carreira` sai do `useProfessoresDados` para um hook próprio, `useCarreira`, que as duas telas usam.

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui (Tabs, Switch, RadioGroup, Select, Popover), Firebase (Firestore), React Router 7 sem `<Routes>`, Vitest com jsdom nos testes de tela. JavaScript e JSX, sem TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md` (seções "As trilhas", "Os números e as metas", "Os períodos", "Configurações → Plano de carreira (mockup A)" e "Endereços"). Visão geral: `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`. Mockup aprovado: `docs/superpowers/specs/mockups/2026-11-26-carreira-editor-a.html` (com `2026-11-26-carreira-base.css` e `2026-11-26-carreira-dados.js`).

**Antes de começar:** o PR 1 (PR #324, branch `claude/competent-williams-e0e98e`) precisa estar na `main`. Com ele mergeado, crie a branch a partir da `main` e confira `git fetch && git rev-list --count HEAD..origin/main` (precisa dar 0). Se o Johnny pedir para começar antes do merge, crie a branch a partir de `claude/competent-williams-e0e98e` e abra o PR empilhado: no merge do #324 pelo `gh`, não apague a branch base, porque isso fecha o PR filho. Rode `npm ci` e `npm test` uma vez para ter a linha de base.

---

## Decisões do plano

Escolhas que a spec e as decisões do Johnny não fecharam. Cada uma está no código do plano.

1. **Endereço da trilha.** O `readScreen` ganha um ramo para `/configuracoes`: `/configuracoes/carreira/<id>` dá `sub: 'carreira'`, `trilhaId` e `trilhaAba: 'metas'`; `/<id>/regras` dá `trilhaAba: 'regras'`. Qualquer outro segmento depois do id cai na regra da sub-tela desconhecida. `trilhaId` e `trilhaAba` vão para o `screenState` e para o alvo do redirect, como o `modelId`. A trilha **não** entra na `screenKey`: a `SettingsView` relê a base inteira de leads ao montar, e abrir uma trilha não pode remontá-la. Limite: abrir uma trilha do fim da lista não leva a tela ao topo. A trilha de outra academia no endereço cai na lista da sessão, como o modelo de rotina.
2. **Abrir e voltar são links.** O cartão da trilha e o "Plano de carreira" do cabeçalho são `AppLink` (push, com Ctrl+clique). Trocar de aba é replace, pelo `goToSub` do App. Arquivar e descartar a trilha nova voltam à lista com replace.
3. **Trilha nova.** "Nova trilha" abre um balão (Popover) com "Para professores" e "Para consultores". O rascunho fica no estado da seção, e não no endereço nem no state da navegação, até salvar: um F5 antes de salvar perde a trilha e mostra a lista. O id é `trilha-` mais 6 letras ou números sorteados, refeito se colidir com um id da lista; o nível novo é `nivel-` mais 6. Sorteado, e não sequencial, para duas abas criando trilha ao mesmo tempo não gravarem no mesmo campo. A trilha nova nasce sem nome, com um nível ("Nível 1"), os números da base ligados com metas em branco, anual em dezembro, vínculo "qualquer" e a ordem depois da última.
4. **O nome da trilha** é editável no cabeçalho, num campo com a cara do título (o mockup não mostrava onde). O nome do nível é editável no topo da coluna, como no mockup.
5. **Níveis.** Cada coluna tem uma lixeira ("Apagar o nível X"). O "+ Nível" acrescenta "Nível N" (o primeiro número livre) no fim, e o nível que deixa de ser o último ganha 12 meses de tempo mínimo. O que vira último perde o tempo mínimo.
6. **Vendas em reais e em quantidade não se comparam:** trocar entre as duas apaga as metas de vendas da trilha.
7. **Trocar a frequência** leva o mês ao padrão dela (dezembro no anual, junho e dezembro no semestral).
8. **Trocar a base** ("Para quem") só sem gente na trilha, e refaz os números e os ajustes da base nova, com metas em branco.
9. **Pessoas por nível** contam pela trilha como está gravada, para o nível apagado no rascunho continuar contando quem está nele, e quem está na trilha sem um nível que exista nela fica numa chave à parte (`_semNivel`). Professor inativo não conta. Consultor é o papel consultor (`roleOf` e `ROLES`), e o gestor fica fora. O consultor só ganha `trilhaId` no PR 3, então a trilha Consultor mostra "ninguém" até lá.
10. **Botão desligado com motivo** (Arquivar trilha, apagar nível, "+ Nível" no limite) usa `aria-disabled`, e não `disabled`: continua no Tab, o motivo vai no `title` e, no Arquivar, num texto só para leitor de tela; o clique mostra o motivo num aviso (`toast.warning`).
11. **As telas de Professores continuam com as metas de antes até o PR 3.** Elas leem as metas do topo do documento (`metasDe`), que a primeira gravação da trilha Professor deixa paradas, como diz a spec. O PR 2 não liga a trilha às telas, como manda a visão geral. Ver "Dúvidas para o Johnny".
12. **A aba Metas da tela Professores** vira um link "Metas da trilha" no cabeçalho, que leva a `/configuracoes/carreira/professor`.
13. **O `useCarreira`** sai do `useProfessoresDados` com a mesma assinatura do documento, para as Configurações lerem as trilhas sem as leituras de clientes, aulas e presenças. A `SettingsView` passa a receber `listenersActive` do App. Sai também o `salvarMetas`, que gravava o documento inteiro com `setDoc` sem `merge` e apagaria o campo `trilhas`.
14. **Textos, ícones e classes compartilhadas** do editor moram em `src/views/settings/carreira/carreiraTexto.js`, em JS sem JSX, porque o `react-refresh` reprova `.jsx` que exporta constante.
15. **Campo de número:** o texto digitado fica no próprio campo, e o rascunho recebe o número (`null` quando vazio, `NaN` quando não é número, que o `problemaDaTrilha` recusa). Vírgula vale como decimal. O campo de vendas em reais mostra mil reais e grava reais.

## Dúvidas para o Johnny

- **Metas da Professor entre o PR 2 e o PR 3.** Com a aba Metas fora, a lista e o perfil dos professores seguem com as metas gravadas antes (renovação 45, 55 e 65, nota 9, aderência 60 a 70). O que o gestor mudar na trilha Professor só aparece nessas telas quando o PR 3 entrar. A outra saída é uma ponte que leia a trilha Professor nas telas de hoje já no PR 2, com perda (as telas de hoje têm uma nota e uma faixa para todos os níveis e só conhecem Júnior, Pleno e Sênior). O plano segue a primeira, por ser a que a visão geral descreve.
- **Trava da Professor.** O plano trava só a frequência e o mês, como pedido. Acrescentar, apagar e renomear níveis da Professor fica livre; as telas de hoje continuam lendo Júnior, Pleno e Sênior até o PR 3.

---

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| Criar `src/lib/carreira/rascunho.js` | o rascunho da trilha: id novo, trilha nova, níveis, números, metas, ajustes, calendário, base, pessoas por nível, o que conta como mudança e a trilha no formato de gravar |
| Criar `src/lib/carreiraWrites.js` | `salvarTrilha`: confere com o `problemaDaTrilha` e grava `trilhas.<id>` pelo caminho do campo |
| Criar `src/hooks/useCarreira.js` | a assinatura de `stronix_config/carreira` e as trilhas lidas dela |
| Criar `src/views/settings/carreira/carreiraTexto.js` | textos, ícones, unidades, classes de botão e a leitura do número digitado |
| Criar `src/views/settings/carreira/CampoNumero.jsx` | o campo com a unidade por dentro e o "sem meta" tracejado |
| Criar `src/views/settings/carreira/TrilhaGrade.jsx` | a aba Níveis e metas |
| Criar `src/views/settings/carreira/TrilhaRegras.jsx` | a aba Regras da trilha |
| Criar `src/views/settings/carreira/TrilhaEditor.jsx` | cabeçalho, abas, rascunho e barra de salvar |
| Criar `src/views/settings/carreira/CarreiraSettingsSection.jsx` | a lista das trilhas, a trilha nova, arquivar e desarquivar, e qual trilha abre |
| Modificar `src/hooks/useProfessoresDados.js` | usa o `useCarreira`; sai o `salvarMetas` |
| Modificar `src/lib/routes.js` | seção `carreira`, trilha e aba no endereço, `/professores/metas` levando à trilha Professor |
| Modificar `src/lib/appShell.js` | `trilhaId` e `trilhaAba` no `screenState` |
| Modificar `src/lib/sentryScrub.js` | `/configuracoes/carreira/:trilhaId` |
| Modificar `src/lib/settingsRail.js` e `src/views/settings/settingsRailIcons.js` | o item Plano de carreira no grupo Equipe, só com o módulo |
| Modificar `src/views/settings/SettingsView.jsx` | monta a seção |
| Modificar `src/App.jsx` | passa a trilha, a aba, a troca de aba e o `listenersActive` às Configurações |
| Modificar `src/views/professores/ProfessoresView.jsx` | sai a aba Metas, entra o link "Metas da trilha" |
| Apagar `src/views/professores/MetasForm.jsx` | |
| Testes novos: `carreira.rascunho.test.js`, `carreiraWrites.test.js`, `carreiraTexto.test.js`, `routes.carreira.test.js`, `carreiraEditor.behavior.test.js`, `carreiraSettings.behavior.test.js` | |
| Testes que mudam: `carreiraImports.test.js`, `settingsRail.test.js`, `settingsRail.behavior.test.js`, `routes.professores.test.js`, `professoresView.behavior.test.js`, `professorPerfil.behavior.test.js` | |
| Modificar `CLAUDE.md` | seções "Plano de carreira", "Perfil do professor" e "Endereço de cada tela" |

---

### Task 1: o rascunho da trilha

**Files:**
- Create: `src/lib/carreira/rascunho.js`
- Create: `src/lib/__tests__/carreira.rascunho.test.js`
- Modify: `src/lib/__tests__/carreiraImports.test.js:42-44`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreira.rascunho.test.js`:

```js
// O rascunho da trilha do editor de Configurações → Plano de carreira (plano
// 2026-11-26-plano-de-carreira-02, tarefa 1): cada operação devolve uma trilha
// nova, sem mexer na que recebeu.
import { describe, it, expect } from 'vitest';
import { trilhasDe } from '../carreira/trilhas.js';
import { problemaDaTrilha } from '../carreira/validacao.js';
import {
  acrescentarNivel, apagarNivel, com, ligarNumero, metasEmBranco, MOTIVO_DO_ARQUIVAR, motivoDoApagar, mudou, novaTrilha,
  novoId, pessoasPorNivel, renomearNivel, SEM_NIVEL, totalDePessoas, trilhaParaGravar, trocarAjuste, trocarBase,
  trocarFrequencia, trocarMeses, trocarMeta, trocarSugestao,
} from '../carreira/rascunho.js';

const TRILHAS = trilhasDe(null);
const [PROFESSOR, ESTAGIARIO, CONSULTOR] = TRILHAS;
const zero = () => 0;
const ids = (t) => t.niveis.map((n) => n.id);

describe('novoId', () => {
  it('é o prefixo com 6 letras ou números sorteados', () => {
    expect(novoId('trilha', [], zero)).toBe('trilha-000000');
    expect(novoId('trilha', [], () => 0.5)).toBe('trilha-i00000');
    expect(novoId('nivel', [], Math.random)).toMatch(/^nivel-[0-9a-z]{6}$/);
  });

  it('sorteia de novo quando o id já existe, e desiste depois de 50 tentativas', () => {
    const vez = [0, 0.5];
    let i = 0;
    expect(novoId('trilha', ['trilha-000000'], () => vez[i++])).toBe('trilha-i00000');
    expect(() => novoId('trilha', ['trilha-000000'], zero)).toThrow('Não deu para gerar um id novo.');
  });
});

describe('novaTrilha', () => {
  it('de professor: um nível, os quatro números ligados em branco, anual em dezembro e depois da última', () => {
    expect(novaTrilha('professor', TRILHAS, zero)).toEqual({
      id: 'trilha-000000',
      nome: '',
      base: 'professor',
      sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
      frequencia: 'anual',
      mes: 12,
      janelaRenovacao: '12meses',
      niveis: [{ id: 'nivel-000000', nome: 'Nível 1', mesesMinimos: null }],
      numeros: {
        renovacao: { ligado: true, metas: { 'nivel-000000': null } },
        nps: { ligado: true, metas: { 'nivel-000000': null } },
        conversao: { ligado: true, metas: { 'nivel-000000': null } },
        aderencia: { ligado: true, metas: { 'nivel-000000': null } },
      },
      ajustes: { janelaDias: 30, barra: 2, faixaMax: 70 },
      arquivada: false,
      ordem: 3,
    });
  });

  it('de consultor: os quatro números do consultor e as vendas em reais', () => {
    const t = novaTrilha('consultor', TRILHAS, zero);
    expect(Object.keys(t.numeros)).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
    expect(t.ajustes).toEqual({ vendasEm: 'reais' });
  });

  it('sem trilha nenhuma, a ordem é 0; e só falta o nome para gravar', () => {
    const t = novaTrilha('professor', [], zero);
    expect(t.ordem).toBe(0);
    expect(problemaDaTrilha(t)).toEqual({ campo: 'nome', texto: 'Dê um nome à trilha.' });
    expect(problemaDaTrilha(com(t, { nome: 'Pilates' }))).toBeNull();
  });
});

describe('níveis', () => {
  it('acrescentar põe "Nível N" no fim, com meta em branco, e o antigo último ganha 12 meses', () => {
    const t = acrescentarNivel(PROFESSOR, zero);
    expect(t.niveis).toEqual([
      { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
      { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
      { id: 'senior', nome: 'Sênior', mesesMinimos: 12 },
      { id: 'nivel-000000', nome: 'Nível 4', mesesMinimos: null },
    ]);
    Object.values(t.numeros).forEach((n) => expect(n.metas['nivel-000000']).toBeNull());
    expect(t.numeros.renovacao.metas.junior).toBe(45);
    expect(ids(PROFESSOR)).toEqual(['junior', 'pleno', 'senior']);
  });

  it('acrescentar pula o nome que já existe e para no limite de 6', () => {
    const doisNiveis = { ...PROFESSOR, niveis: [{ id: 'a', nome: 'A', mesesMinimos: 6 }, { id: 'b', nome: 'nível 3', mesesMinimos: null }] };
    expect(acrescentarNivel(doisNiveis, zero).niveis[2].nome).toBe('Nível 4');
    const seis = { ...PROFESSOR, niveis: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, nome: `N${i}`, mesesMinimos: i === 5 ? null : 6 })) };
    expect(acrescentarNivel(seis, zero)).toBe(seis);
  });

  it('apagar o último tira as metas dele e o novo último perde o tempo mínimo', () => {
    const t = apagarNivel(PROFESSOR, 'senior');
    expect(t.niveis).toEqual([
      { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
      { id: 'pleno', nome: 'Pleno', mesesMinimos: null },
    ]);
    expect(t.numeros.renovacao.metas).toEqual({ junior: 45, pleno: 55 });
  });

  it('apagar do meio mantém o tempo dos outros; o único nível e o que não existe ficam', () => {
    expect(apagarNivel(PROFESSOR, 'pleno').niveis.map((n) => n.mesesMinimos)).toEqual([12, null]);
    const um = apagarNivel(apagarNivel(PROFESSOR, 'senior'), 'pleno');
    expect(apagarNivel(um, 'junior')).toBe(um);
    expect(apagarNivel(PROFESSOR, 'xyz')).toBe(PROFESSOR);
  });

  it('renomear e trocar os meses mexem só no nível pedido', () => {
    expect(renomearNivel(PROFESSOR, 'pleno', 'Pleno I').niveis[1].nome).toBe('Pleno I');
    expect(trocarMeses(PROFESSOR, 'junior', 18).niveis.map((n) => n.mesesMinimos)).toEqual([18, 24, null]);
    expect(PROFESSOR.niveis[0].mesesMinimos).toBe(12);
  });

  it('o motivo para não apagar: o único nível e o nível com gente', () => {
    const pessoas = { junior: 2, pleno: 0, senior: 0 };
    expect(motivoDoApagar(PROFESSOR, PROFESSOR.niveis[0], pessoas)).toBe('Júnior tem gente. Passe as pessoas para outro nível antes de apagar.');
    expect(motivoDoApagar(PROFESSOR, PROFESSOR.niveis[1], pessoas)).toBeNull();
    const um = apagarNivel(apagarNivel(PROFESSOR, 'senior'), 'pleno');
    expect(motivoDoApagar(um, um.niveis[0], {})).toBe('A trilha precisa de pelo menos um nível.');
  });
});

describe('números, metas e ajustes', () => {
  it('desligar guarda as metas, para ligar de novo devolver', () => {
    const off = ligarNumero(PROFESSOR, 'nps', false);
    expect(off.numeros.nps).toEqual({ ligado: false, metas: { junior: 9, pleno: 9, senior: 9 } });
    expect(off.numeros.renovacao).toBe(PROFESSOR.numeros.renovacao);
    expect(ligarNumero(off, 'nps', true).numeros.nps.ligado).toBe(true);
  });

  it('trocar a meta de um nível', () => {
    const t = trocarMeta(PROFESSOR, 'renovacao', 'junior', 50);
    expect(t.numeros.renovacao.metas).toEqual({ junior: 50, pleno: 55, senior: 65 });
    expect(PROFESSOR.numeros.renovacao.metas.junior).toBe(45);
  });

  it('trocar vendas entre reais e quantidade apaga as metas de vendas', () => {
    const comMeta = trocarMeta(CONSULTOR, 'vendas', 'junior', 12000);
    const emQuantidade = trocarAjuste(comMeta, 'vendasEm', 'quantidade');
    expect(emQuantidade.ajustes.vendasEm).toBe('quantidade');
    expect(emQuantidade.numeros.vendas.metas).toEqual({ junior: null, pleno: null, senior: null });
    expect(trocarAjuste(comMeta, 'vendasEm', 'reais').numeros.vendas.metas.junior).toBe(12000);
    expect(trocarAjuste(PROFESSOR, 'barra', 3).ajustes).toEqual({ janelaDias: 30, barra: 3, faixaMax: 70 });
  });

  it('metas em branco contam só os números ligados', () => {
    expect(metasEmBranco(CONSULTOR)).toBe(12);
    expect(metasEmBranco(ligarNumero(CONSULTOR, 'vendas', false))).toBe(9);
    expect(metasEmBranco(PROFESSOR)).toBe(0);
    expect(metasEmBranco(trocarMeta(PROFESSOR, 'nps', 'pleno', null))).toBe(1);
  });
});

describe('calendário, base e sugestão', () => {
  it('trocar a frequência leva o mês ao padrão dela', () => {
    expect(trocarFrequencia(PROFESSOR, 'semestral')).toMatchObject({ frequencia: 'semestral', mes: 6 });
    expect(trocarFrequencia(ESTAGIARIO, 'anual')).toMatchObject({ frequencia: 'anual', mes: 12 });
    expect(trocarFrequencia(PROFESSOR, 'anual')).toBe(PROFESSOR);
  });

  it('trocar a base refaz os números e os ajustes, com metas em branco', () => {
    const t = trocarBase(novaTrilha('professor', TRILHAS, zero), 'consultor');
    expect(t.base).toBe('consultor');
    expect(t.numeros).toEqual({
      consultorConversao: { ligado: true, metas: { 'nivel-000000': null } },
      vendas: { ligado: true, metas: { 'nivel-000000': null } },
      consultorRenovacao: { ligado: true, metas: { 'nivel-000000': null } },
      metaDiaria: { ligado: true, metas: { 'nivel-000000': null } },
    });
    expect(t.ajustes).toEqual({ vendasEm: 'reais' });
    expect(trocarBase(PROFESSOR, 'professor')).toBe(PROFESSOR);
  });

  it('trocar a sugestão junta com a que existe', () => {
    expect(trocarSugestao(PROFESSOR, { modalidadeIds: ['func'] }).sugestao).toEqual({ vinculo: 'formado', modalidadeIds: ['func'] });
  });
});

describe('pessoas por nível', () => {
  const PROFESSORES = [
    { id: 'p1', nivel: 'junior' },
    { id: 'p2', nivel: 'junior', ativo: true },
    { id: 'p3', nivel: 'pleno' },
    { id: 'p4', nivel: 'senior', ativo: false },
    { id: 'p5', trilhaId: 'estagiario', nivel: 'estagiario1' },
    { id: 'p6', nivel: 'xyz' },
  ];
  const USUARIOS = [
    { id: 'c1', role: 'consultant', trilhaId: 'consultor', nivel: 'pleno' },
    { id: 'g1', role: 'admin', trilhaId: 'consultor', nivel: 'junior' },
    { id: 'c2', role: 'consultant' },
  ];

  it('o professor sem trilha é da Professor, o inativo fica fora e o nível que não existe vai para sem nível', () => {
    expect(pessoasPorNivel(PROFESSOR, { professores: PROFESSORES, usuarios: USUARIOS })).toEqual({ junior: 2, pleno: 1, senior: 0, [SEM_NIVEL]: 1 });
    expect(pessoasPorNivel(ESTAGIARIO, { professores: PROFESSORES })).toEqual({ estagiario1: 1, estagiario2: 0, estagiario3: 0, [SEM_NIVEL]: 0 });
  });

  it('na trilha de consultor conta só o papel consultor com a trilha gravada', () => {
    expect(pessoasPorNivel(CONSULTOR, { professores: PROFESSORES, usuarios: USUARIOS })).toEqual({ junior: 0, pleno: 1, senior: 0, [SEM_NIVEL]: 0 });
  });

  it('o total soma todas as chaves', () => {
    expect(totalDePessoas({ junior: 2, pleno: 1, [SEM_NIVEL]: 1 })).toBe(4);
    expect(totalDePessoas({})).toBe(0);
  });

  it('o motivo do arquivar é o mesmo texto da gravação', () => {
    expect(MOTIVO_DO_ARQUIVAR).toBe('Só dá para arquivar a trilha sem ninguém nela.');
  });
});

describe('a trilha no formato de gravar', () => {
  it('leva o que o lerTrilha lê, sem o id e sem a marca de padrão', () => {
    expect(trilhaParaGravar(PROFESSOR)).toEqual({
      nome: 'Professor',
      base: 'professor',
      sugestao: { vinculo: 'formado', modalidadeIds: [] },
      frequencia: 'anual',
      mes: 12,
      janelaRenovacao: '12meses',
      niveis: [
        { id: 'junior', nome: 'Júnior', mesesMinimos: 12 },
        { id: 'pleno', nome: 'Pleno', mesesMinimos: 24 },
        { id: 'senior', nome: 'Sênior', mesesMinimos: null },
      ],
      numeros: {
        renovacao: { ligado: true, metas: { junior: 45, pleno: 55, senior: 65 } },
        nps: { ligado: true, metas: { junior: 9, pleno: 9, senior: 9 } },
        conversao: { ligado: true, metas: { junior: 0, pleno: 0, senior: 0 } },
        aderencia: { ligado: true, metas: { junior: 60, pleno: 60, senior: 60 } },
      },
      ajustes: { janelaDias: 30, barra: 2, faixaMax: 70 },
      arquivada: false,
      ordem: 0,
    });
  });

  it('apara os nomes e troca número que não vale por branco (meta) ou pelo padrão (ajuste)', () => {
    let t = com(PROFESSOR, { nome: '  Professor  ' });
    t = renomearNivel(t, 'pleno', ' Pleno ');
    t = trocarMeta(ligarNumero(t, 'nps', false), 'nps', 'junior', Number.NaN);
    t = trocarAjuste(ligarNumero(t, 'conversao', false), 'janelaDias', Number.NaN);
    const g = trilhaParaGravar(t);
    expect(g.nome).toBe('Professor');
    expect(g.niveis[1].nome).toBe('Pleno');
    expect(g.numeros.nps.metas.junior).toBeNull();
    expect(g.ajustes.janelaDias).toBe(30);
  });

  it('o que conta como mudança', () => {
    expect(mudou(PROFESSOR, PROFESSOR)).toBe(false);
    expect(mudou({ ...PROFESSOR }, PROFESSOR)).toBe(false);
    expect(mudou(trocarMeta(PROFESSOR, 'renovacao', 'junior', 50), PROFESSOR)).toBe(true);
    expect(mudou(PROFESSOR, null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreira.rascunho.test.js`
Expected: FAIL, "Failed to resolve import ../carreira/rascunho.js".

- [ ] **Step 3: Write the implementation**

Crie `src/lib/carreira/rascunho.js`:

```js
// O rascunho de uma trilha no editor de Configurações → Plano de carreira
// (spec 2026-11-26-plano-de-carreira-configuravel, "Configurações → Plano de
// carreira (mockup A)"). Cada operação recebe a trilha no formato do lerTrilha
// e devolve outra, sem mexer na que recebeu. Quem diz o que pode gravar é o
// problemaDaTrilha (validacao.js), que a tela roda a cada mudança e o
// salvarTrilha roda de novo. Puro e sem pacote (carreiraImports.test.js).
import { roleOf, ROLES } from '../acesso.js';
import { AJUSTES, NUMEROS, numerosDaBase } from './numeros.js';
import { mesesDaAvaliacao } from './periodo.js';
import { MAX_NIVEIS, nivelDaPessoa, trilhaDaPessoa } from './trilhas.js';

// A chave de pessoasPorNivel de quem está na trilha sem um nível que exista nela.
export const SEM_NIVEL = '_semNivel';
export const MOTIVO_DO_ARQUIVAR = 'Só dá para arquivar a trilha sem ninguém nela.';
// O tempo mínimo que o nível ganha quando deixa de ser o último.
const MESES_DO_NIVEL_NOVO = 12;

export const com = (t, patch) => ({ ...t, ...patch });
const comNumeros = (t, f) => ({
  ...t,
  numeros: Object.fromEntries(Object.entries(t.numeros).map(([id, n]) => [id, f(n, id)])),
});
const metasEmBrancoDe = (niveis) => Object.fromEntries(niveis.map((n) => [n.id, null]));
const numerosNovos = (base, niveis) => Object.fromEntries(
  numerosDaBase(base).map((id) => [id, { ligado: true, metas: metasEmBrancoDe(niveis) }]),
);
function ajustesNovos(base) {
  const out = {};
  Object.entries(AJUSTES).forEach(([k, a]) => {
    if (NUMEROS[a.numero].base === base) out[k] = a.padrao;
  });
  if (base === 'consultor') out.vendasEm = 'reais';
  return out;
}

// Id novo que não colide com os usados: o prefixo e 6 letras ou números
// sorteados. Sorteado, e não sequencial, para duas abas criando trilha ao mesmo
// tempo não gravarem no mesmo campo. O formato serve para o endereço
// (isValidLeadId) e para o caminho do campo no updateDoc.
export function novoId(prefixo, usados = [], aleatorio = Math.random) {
  const ja = new Set(usados);
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    const id = `${prefixo}-${Math.floor(aleatorio() * 36 ** 6).toString(36).padStart(6, '0')}`;
    if (!ja.has(id)) return id;
  }
  throw new Error('Não deu para gerar um id novo.');
}

// A trilha nova: um nível, os números da base ligados com metas em branco,
// anual em dezembro e depois da última da lista. O nome nasce vazio, para o
// gestor digitar.
export function novaTrilha(base, trilhas = [], aleatorio = Math.random) {
  const b = base === 'consultor' ? 'consultor' : 'professor';
  const niveis = [{ id: novoId('nivel', [], aleatorio), nome: 'Nível 1', mesesMinimos: null }];
  const ordens = trilhas.map((t) => t.ordem).filter(Number.isFinite);
  return {
    id: novoId('trilha', trilhas.map((t) => t.id), aleatorio),
    nome: '',
    base: b,
    sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
    frequencia: 'anual',
    mes: 12,
    janelaRenovacao: '12meses',
    niveis,
    numeros: numerosNovos(b, niveis),
    ajustes: ajustesNovos(b),
    arquivada: false,
    ordem: ordens.length ? Math.max(...ordens) + 1 : 0,
  };
}

// "+ Nível": "Nível N" no fim, com o primeiro N livre, e metas em branco. O
// nível que deixa de ser o último ganha tempo mínimo. No limite, nada muda.
export function acrescentarNivel(t, aleatorio = Math.random) {
  if (t.niveis.length >= MAX_NIVEIS) return t;
  const nomes = new Set(t.niveis.map((n) => String(n.nome).trim().toLocaleLowerCase('pt-BR')));
  let k = t.niveis.length + 1;
  while (nomes.has(`nível ${k}`)) k += 1;
  const novo = { id: novoId('nivel', t.niveis.map((n) => n.id), aleatorio), nome: `Nível ${k}`, mesesMinimos: null };
  const ultimo = t.niveis.length - 1;
  const niveis = [
    ...t.niveis.map((n, i) => (i === ultimo ? { ...n, mesesMinimos: n.mesesMinimos ?? MESES_DO_NIVEL_NOVO } : n)),
    novo,
  ];
  return comNumeros({ ...t, niveis }, (n) => ({ ...n, metas: { ...n.metas, [novo.id]: null } }));
}

// Tira o nível e as metas dele. O que fica por último perde o tempo mínimo. O
// único nível e o nível que não existe ficam. Quem confere se o nível tem gente
// é o motivoDoApagar (na tela) e o problemaDaTrilha (ao gravar).
export function apagarNivel(t, nivelId) {
  if (t.niveis.length <= 1 || !t.niveis.some((n) => n.id === nivelId)) return t;
  const restantes = t.niveis.filter((n) => n.id !== nivelId);
  const niveis = restantes.map((n, i) => (i === restantes.length - 1 ? { ...n, mesesMinimos: null } : n));
  return comNumeros({ ...t, niveis }, (n) => ({
    ...n,
    metas: Object.fromEntries(Object.entries(n.metas).filter(([id]) => id !== nivelId)),
  }));
}

const comNivel = (t, nivelId, patch) => ({ ...t, niveis: t.niveis.map((n) => (n.id === nivelId ? { ...n, ...patch } : n)) });
export const renomearNivel = (t, nivelId, nome) => comNivel(t, nivelId, { nome });
export const trocarMeses = (t, nivelId, mesesMinimos) => comNivel(t, nivelId, { mesesMinimos });

// Desligar guarda as metas, para ligar de novo devolver o que estava.
export const ligarNumero = (t, numeroId, ligado) => comNumeros(t, (n, id) => (id === numeroId ? { ...n, ligado } : n));
export const trocarMeta = (t, numeroId, nivelId, valor) => comNumeros(t, (n, id) => (id === numeroId ? { ...n, metas: { ...n.metas, [nivelId]: valor } } : n));

export function trocarAjuste(t, chave, valor) {
  const proxima = { ...t, ajustes: { ...t.ajustes, [chave]: valor } };
  if (chave !== 'vendasEm' || valor === t.ajustes?.vendasEm || !t.numeros.vendas) return proxima;
  // Reais e quantidade não se comparam: a meta de um não serve no outro.
  return { ...proxima, numeros: { ...proxima.numeros, vendas: { ...proxima.numeros.vendas, metas: metasEmBrancoDe(t.niveis) } } };
}

// O mês volta ao padrão da frequência: dezembro no anual, junho no semestral.
export const trocarFrequencia = (t, frequencia) => (frequencia === t.frequencia
  ? t
  : { ...t, frequencia, mes: mesesDaAvaliacao({ frequencia })[0] });

// Só sem gente na trilha (a tela trava, e o problemaDaTrilha recusa ao gravar).
export function trocarBase(t, base) {
  if (base === t.base) return t;
  return {
    ...t,
    base,
    sugestao: { vinculo: 'qualquer', modalidadeIds: [] },
    numeros: numerosNovos(base, t.niveis),
    ajustes: ajustesNovos(base),
  };
}

export const trocarSugestao = (t, patch) => ({ ...t, sugestao: { ...t.sugestao, ...patch } });

// Quantas metas dos números ligados estão em branco (a barra de salvar avisa).
export function metasEmBranco(t) {
  return numerosDaBase(t.base).reduce((soma, id) => {
    const n = t.numeros[id];
    return n?.ligado ? soma + t.niveis.filter((nivel) => n.metas[nivel.id] == null).length : soma;
  }, 0);
}

// Quem está em cada nível da trilha: os professores ativos (o sem trilha é da
// Professor) e os usuários com o papel consultor. Quem está na trilha com um
// nível que não existe nela conta em SEM_NIVEL. Chame com a trilha como está
// gravada, para o nível apagado no rascunho continuar contando quem está nele.
export function pessoasPorNivel(trilha, { professores = [], usuarios = [] } = {}) {
  const out = Object.fromEntries(trilha.niveis.map((n) => [n.id, 0]));
  out[SEM_NIVEL] = 0;
  const contar = (p) => {
    const nivel = nivelDaPessoa(p, trilha);
    out[nivel ? nivel.id : SEM_NIVEL] += 1;
  };
  (professores || []).filter((p) => p?.ativo !== false && trilhaDaPessoa(p, [trilha], { professor: true })).forEach(contar);
  (usuarios || []).filter((u) => roleOf(u) === ROLES.CONSULTOR && trilhaDaPessoa(u, [trilha])).forEach(contar);
  return out;
}

export const totalDePessoas = (pessoas) => Object.values(pessoas || {}).reduce((s, n) => s + (Number(n) || 0), 0);

// Por que o nível não pode sair agora, ou null. O texto do nível com gente é o
// mesmo do problemaDaTrilha.
export function motivoDoApagar(t, nivel, pessoas) {
  if (t.niveis.length <= 1) return 'A trilha precisa de pelo menos um nível.';
  if ((Number(pessoas?.[nivel.id]) || 0) > 0) return `${nivel.nome} tem gente. Passe as pessoas para outro nível antes de apagar.`;
  return null;
}

const finitoOu = (v, outro) => (typeof v === 'number' && Number.isFinite(v) ? v : outro);

// O campo trilhas.<id> do documento: o que o lerTrilha lê, sem o id e sem a
// marca de padrão, com os nomes aparados. Meta que não é número vira branco, e
// ajuste que não é número vira o padrão (o problemaDaTrilha já recusou o que
// conta; isto cobre o número desligado). A ordem das chaves é fixa, porque o
// `mudou` compara o texto.
export function trilhaParaGravar(t) {
  const ultimo = t.niveis.length - 1;
  const niveis = t.niveis.map((n, i) => ({
    id: n.id,
    nome: String(n.nome ?? '').trim(),
    mesesMinimos: i === ultimo ? null : n.mesesMinimos,
  }));
  const numeros = Object.fromEntries(numerosDaBase(t.base).map((id) => [id, {
    ligado: t.numeros?.[id]?.ligado === true,
    metas: Object.fromEntries(niveis.map((n) => [n.id, finitoOu(t.numeros?.[id]?.metas?.[n.id], null)])),
  }]));
  const padroes = ajustesNovos(t.base);
  const ajustes = Object.fromEntries(Object.entries(padroes).map(([k, p]) => [
    k, typeof p === 'number' ? finitoOu(t.ajustes?.[k], p) : (t.ajustes?.[k] ?? p),
  ]));
  return {
    nome: String(t.nome ?? '').trim(),
    base: t.base,
    sugestao: { vinculo: t.sugestao?.vinculo ?? 'qualquer', modalidadeIds: [...(t.sugestao?.modalidadeIds ?? [])] },
    frequencia: t.frequencia,
    mes: t.mes,
    janelaRenovacao: t.janelaRenovacao,
    niveis,
    numeros,
    ajustes,
    arquivada: t.arquivada === true,
    ordem: t.ordem,
  };
}

// Se o rascunho difere do que está gravado. A trilha nova (sem gravada) sempre difere.
export const mudou = (rascunho, gravada) => !gravada
  || JSON.stringify(trilhaParaGravar(rascunho)) !== JSON.stringify(trilhaParaGravar(gravada));
```

- [ ] **Step 4: Update the imports test**

Em `src/lib/__tests__/carreiraImports.test.js`, troque:

```js
  it('a pasta tem os períodos, os números, as trilhas e a validação', () => {
    expect(ARQUIVOS).toEqual(['numeros.js', 'periodo.js', 'trilhas.js', 'validacao.js']);
  });
```

por:

```js
  it('a pasta tem os períodos, os números, as trilhas, a validação e o rascunho', () => {
    expect(ARQUIVOS).toEqual(['numeros.js', 'periodo.js', 'rascunho.js', 'trilhas.js', 'validacao.js']);
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/carreira.rascunho.test.js src/lib/__tests__/carreiraImports.test.js`
Expected: PASS. O `rascunho.js` importa `../acesso.js`, que não importa nada, então o teste de imports continua sem pacote.

- [ ] **Step 6: Commit**

```bash
git add src/lib/carreira/rascunho.js src/lib/__tests__/carreira.rascunho.test.js src/lib/__tests__/carreiraImports.test.js
git commit -m "feat: rascunho da trilha de carreira"
```

---

### Task 2: a gravação da trilha

**Files:**
- Create: `src/lib/carreiraWrites.js`
- Create: `src/lib/__tests__/carreiraWrites.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreiraWrites.test.js`:

```js
// A gravação da trilha (plano 2026-11-26-plano-de-carreira-02, tarefa 2): o
// campo trilhas.<id> inteiro pelo caminho do campo, sem mesclar; o documento
// que não existe nasce com setDoc e merge; o que o problemaDaTrilha recusa não
// grava.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const banco = vi.hoisted(() => ({ existe: true, falha: null, updates: [], sets: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', CONFIG_PATH: 'stronix_config' }));
vi.mock('firebase/firestore', () => {
  class FieldPath {
    constructor(...segs) { this.segs = segs; }
  }
  return {
    FieldPath,
    doc: (_db, ...partes) => ({ path: partes.join('/') }),
    serverTimestamp: () => 'AGORA',
    updateDoc: async (ref, campo, valor, ...resto) => {
      if (banco.falha) throw banco.falha;
      if (!banco.existe) throw Object.assign(new Error('No document to update'), { code: 'not-found' });
      banco.updates.push({ path: ref.path, campo: campo.segs, valor, resto });
    },
    setDoc: async (ref, dados, opcoes) => { banco.sets.push({ path: ref.path, dados, opcoes }); },
  };
});

const { salvarTrilha } = await import('../carreiraWrites.js');
const { trilhasDe } = await import('../carreira/trilhas.js');
const { com, MOTIVO_DO_ARQUIVAR, trilhaParaGravar } = await import('../carreira/rascunho.js');

const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);
const CAMINHO = 'artifacts/acad/public/data/stronix_config/carreira';
const salvar = (trilha, extra = {}) => salvarTrilha({}, {
  trilha, gravada: PROFESSOR, outras: [ESTAGIARIO, CONSULTOR], pessoasPorNivel: { junior: 2 }, appUser: { id: 'g1' }, ...extra,
});

beforeEach(() => {
  banco.existe = true;
  banco.falha = null;
  banco.updates = [];
  banco.sets = [];
});

describe('salvarTrilha', () => {
  it('troca o campo trilhas.<id> inteiro, com quem gravou e a hora', async () => {
    const t = com(PROFESSOR, { nome: 'Professor formado' });
    await salvar(t);
    expect(banco.updates).toEqual([{
      path: CAMINHO,
      campo: ['trilhas', 'professor'],
      valor: { ...trilhaParaGravar(t), updatedAt: 'AGORA', updatedBy: 'g1' },
      resto: [],
    }]);
    expect(banco.updates[0].valor).not.toHaveProperty('id');
    expect(banco.updates[0].valor).not.toHaveProperty('padrao');
    expect(banco.sets).toEqual([]);
  });

  it('sem documento, cria com setDoc e merge', async () => {
    banco.existe = false;
    await salvar(PROFESSOR);
    expect(banco.sets).toEqual([{
      path: CAMINHO,
      dados: { trilhas: { professor: { ...trilhaParaGravar(PROFESSOR), updatedAt: 'AGORA', updatedBy: 'g1' } } },
      opcoes: { merge: true },
    }]);
  });

  it('sem quem gravou, grava null', async () => {
    await salvar(PROFESSOR, { appUser: null });
    expect(banco.updates[0].valor.updatedBy).toBeNull();
  });

  it('o que o problemaDaTrilha recusa não grava, com o texto para a tela', async () => {
    await expect(salvar(com(PROFESSOR, { nome: ' ' }))).rejects.toMatchObject({ message: 'Dê um nome à trilha.', paraTela: true });
    await expect(salvar(com(PROFESSOR, { nome: 'Estagiário' }))).rejects.toMatchObject({ message: 'Já existe uma trilha com esse nome.' });
    expect(banco.updates).toEqual([]);
  });

  it('arquivar só sem gente', async () => {
    await expect(salvar(com(PROFESSOR, { arquivada: true }))).rejects.toMatchObject({ message: MOTIVO_DO_ARQUIVAR, paraTela: true });
    expect(banco.updates).toEqual([]);
    await salvar(com(PROFESSOR, { arquivada: true }), { pessoasPorNivel: {} });
    expect(banco.updates[0].valor.arquivada).toBe(true);
  });

  it('outro erro do Firestore sobe e não cria o documento', async () => {
    banco.falha = Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
    await expect(salvar(PROFESSOR)).rejects.toThrow('permission-denied');
    expect(banco.sets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreiraWrites.test.js`
Expected: FAIL, "Failed to resolve import ../carreiraWrites.js".

- [ ] **Step 3: Write the implementation**

Crie `src/lib/carreiraWrites.js`:

```js
// A gravação de uma trilha do plano de carreira (spec
// 2026-11-26-plano-de-carreira-configuravel, "Onde moram"): troca o campo
// trilhas.<id> de stronix_config/carreira inteiro, pelo caminho do campo e sem
// mesclar, para o nível apagado não deixar meta sobrando e duas abas mexendo
// em trilhas diferentes não se apagarem. O documento que ainda não existe
// nasce com setDoc e merge. As regras do Firestore já deixam o gestor gravar
// stronix_config.
import { doc, FieldPath, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { appId, CONFIG_PATH } from './firebase.js';
import { MOTIVO_DO_ARQUIVAR, trilhaParaGravar } from './carreira/rascunho.js';
import { podeArquivar, problemaDaTrilha } from './carreira/validacao.js';

const refCarreira = (db) => doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, 'carreira');
// Erro com texto para a tela (o aviso mostra a mensagem), como no npsWrites.
const erroDaTela = (texto) => Object.assign(new Error(texto), { paraTela: true });

// `gravada` é a trilha como está no banco (null na trilha nova), `outras` são
// as demais trilhas da academia e `pessoasPorNivel` conta quem está em cada
// nível da gravada. A conferência roda de novo aqui, e não só na tela.
export async function salvarTrilha(db, { trilha, gravada = null, outras = [], pessoasPorNivel = {}, appUser = null }) {
  const problema = problemaDaTrilha(trilha, { gravada, outras, pessoasPorNivel });
  if (problema) throw erroDaTela(problema.texto);
  if (trilha.arquivada && !gravada?.arquivada && !podeArquivar(pessoasPorNivel)) throw erroDaTela(MOTIVO_DO_ARQUIVAR);
  const dados = { ...trilhaParaGravar(trilha), updatedAt: serverTimestamp(), updatedBy: appUser?.id ?? null };
  const ref = refCarreira(db);
  try {
    await updateDoc(ref, new FieldPath('trilhas', trilha.id), dados);
  } catch (err) {
    if (err?.code !== 'not-found') throw err;
    // shortcut: se outra aba criar o documento entre o updateDoc e este setDoc,
    // o merge mescla a trilha em vez de trocá-la; a próxima gravação acerta.
    await setDoc(ref, { trilhas: { [trilha.id]: dados } }, { merge: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/carreiraWrites.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/carreiraWrites.js src/lib/__tests__/carreiraWrites.test.js
git commit -m "feat: gravação da trilha de carreira pelo caminho do campo"
```

---

### Task 3: a assinatura das trilhas num hook próprio

**Files:**
- Create: `src/hooks/useCarreira.js`
- Modify: `src/hooks/useProfessoresDados.js`

Mudança sem comportamento novo: a assinatura de `stronix_config/carreira` sai do `useProfessoresDados` para o `useCarreira`, que a seção das Configurações também vai usar. Os testes de hoje (`professoresView.behavior.test.js` e `professorPerfil.behavior.test.js` trocam o `useProfessoresDados` inteiro por um falso) cobrem as telas.

- [ ] **Step 1: Create the hook**

Crie `src/hooks/useCarreira.js`:

```js
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { appId, CONFIG_PATH } from '../lib/firebase.js';
import { trilhasDe } from '../lib/carreira/trilhas.js';

// A assinatura de stronix_config/carreira: as metas de hoje no topo e as
// trilhas no campo `trilhas`. Para com o portão de ociosidade
// (listenersActive) e guarda o último valor. `carreira` é { doc, erro } da
// última resposta, ou null antes da primeira; `trilhas` é null até lá.
const CARREIRA_ID = 'carreira';

export function useCarreira({ db, listenersActive }) {
  const [carreira, setCarreira] = useState(null);
  useEffect(() => {
    if (!db || !listenersActive) return undefined;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID);
    return onSnapshot(
      ref,
      (snap) => setCarreira({ doc: snap.exists() ? snap.data() : null, erro: null }),
      (err) => {
        console.error('useCarreira', err);
        setCarreira({ doc: null, erro: err });
      },
    );
  }, [db, listenersActive]);
  // A Professor, enquanto não foi gravada, sai das metas de hoje (trilhasDe).
  const trilhas = useMemo(() => (carreira ? trilhasDe(carreira.doc) : null), [carreira]);
  return { carreira, trilhas };
}
```

- [ ] **Step 2: Use it in useProfessoresDados**

Em `src/hooks/useProfessoresDados.js`, troque o começo do arquivo (dos imports até a constante `CLIENTES_SPEC_KEY`):

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { appId, CONFIG_PATH, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { planosDoProfessor } from '../lib/professor/carteira.js';
import { limitesDoCiclo } from '../lib/professor/ciclo.js';
import { metasDe } from '../lib/professor/metas.js';
import { TRILHA_PROFESSOR, trilhasDe } from '../lib/carreira/trilhas.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useAulasInWindow } from './useAulasInWindow.js';
import { usePagedLeads } from './usePagedLeads.js';
```

por:

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { appId, CONFIG_PATH, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
import { clientsAllQuerySpec } from '../lib/leadQueries.js';
import { normalizeContracts } from '../lib/operacional/base.js';
import { planosDoProfessor } from '../lib/professor/carteira.js';
import { limitesDoCiclo } from '../lib/professor/ciclo.js';
import { metasDe } from '../lib/professor/metas.js';
import { TRILHA_PROFESSOR } from '../lib/carreira/trilhas.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useAulasInWindow } from './useAulasInWindow.js';
import { useCarreira } from './useCarreira.js';
import { usePagedLeads } from './usePagedLeads.js';
```

E troque o bloco da assinatura:

```js
  // { doc, erro } da última resposta, ou null antes da primeira.
  const [carreira, setCarreira] = useState(null);
  useEffect(() => {
    if (!db || !listenersActive) return undefined;
    const ref = doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID);
    return onSnapshot(
      ref,
      (snap) => setCarreira({ doc: snap.exists() ? snap.data() : null, erro: null }),
      (err) => {
        console.error('useProfessoresDados carreira', err);
        setCarreira({ doc: null, erro: err });
      },
    );
  }, [db, listenersActive]);
  const metas = useMemo(() => (carreira ? metasDe(carreira.doc) : null), [carreira]);
  // As trilhas do plano de carreira, do mesmo documento. A Professor, enquanto
  // não foi gravada, sai das metas de hoje (trilhasDe).
  const trilhas = useMemo(() => (carreira ? trilhasDe(carreira.doc) : null), [carreira]);
  const trilhaProfessor = useMemo(() => trilhas?.find((t) => t.id === TRILHA_PROFESSOR) ?? null, [trilhas]);
```

por:

```js
  // As metas de hoje e as trilhas, do mesmo documento (useCarreira).
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const metas = useMemo(() => (carreira ? metasDe(carreira.doc) : null), [carreira]);
  const trilhaProfessor = useMemo(() => trilhas?.find((t) => t.id === TRILHA_PROFESSOR) ?? null, [trilhas]);
```

O `CARREIRA_ID`, o `doc`, o `setDoc` e o `CONFIG_PATH` continuam, porque o `salvarMetas` ainda usa (ele sai na Task 10).

- [ ] **Step 3: Run lint and the screen tests**

Run: `npx eslint src/hooks/useCarreira.js src/hooks/useProfessoresDados.js && npx vitest run src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/professorPerfil.behavior.test.js`
Expected: lint sem erro e os testes PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCarreira.js src/hooks/useProfessoresDados.js
git commit -m "refactor: assinatura das trilhas de carreira num hook próprio"
```

---

### Task 4: a trilha no endereço das Configurações

**Files:**
- Modify: `src/lib/routes.js`
- Modify: `src/lib/appShell.js:46-48`
- Modify: `src/lib/sentryScrub.js:118-125`
- Create: `src/lib/__tests__/routes.carreira.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/routes.carreira.test.js`:

```js
// Configurações → Plano de carreira no endereço (plano
// 2026-11-26-plano-de-carreira-02, tarefa 4): a lista em
// /configuracoes/carreira, a trilha em /configuracoes/carreira/<id> e a aba das
// regras em /<id>/regras, lidas à parte no readScreen, no molde do modelo de
// rotina.
import { describe, it, expect } from 'vitest';
import { hrefFor, parseAppPath, routeDecision, routeTemplate, screenKey } from '../routes.js';
import { screenState } from '../appShell.js';
import { scrubLeadPath } from '../sentryScrub.js';

const T = 'stronix-crm-app';
const gestor = { id: 'u1', role: 'admin', tenantId: T, tenantModules: ['faltosos'] };
const decide = (path, user) => routeDecision(parseAppPath(path), user);

describe('endereço do plano de carreira', () => {
  it('a lista, a trilha e a aba das regras', () => {
    expect(parseAppPath(`/${T}/configuracoes/carreira`)).toMatchObject({ screen: 'settings', sub: 'carreira', subUnknown: false });
    expect('trilhaId' in parseAppPath(`/${T}/configuracoes/carreira`)).toBe(false);
    expect(parseAppPath(`/${T}/configuracoes/carreira/professor`)).toMatchObject({ screen: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'metas', subUnknown: false });
    expect(parseAppPath(`/${T}/configuracoes/carreira/trilha-a1b2c3/regras`)).toMatchObject({ sub: 'carreira', trilhaId: 'trilha-a1b2c3', trilhaAba: 'regras' });
    expect(parseAppPath(`/${T}/configuracoes/Carreira/professor/REGRAS`)).toMatchObject({ trilhaId: 'professor', trilhaAba: 'regras' });
  });

  it('segmento a mais é sub-tela desconhecida, e as outras seções não leem id', () => {
    expect(parseAppPath(`/${T}/configuracoes/carreira/professor/x`)).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(parseAppPath(`/${T}/configuracoes/carreira/professor/regras/x`)).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(parseAppPath(`/${T}/configuracoes/equipe/professor`)).toMatchObject({ screen: 'settings', subUnknown: true });
    expect(parseAppPath(`/${T}/configuracoes/equipe`)).toMatchObject({ screen: 'settings', sub: 'team', rest: ['equipe'] });
  });

  it('hrefFor monta os três endereços, e o id que não serve some', () => {
    expect(hrefFor(T, 'settings', { sub: 'carreira' })).toBe(`/${T}/configuracoes/carreira`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'professor' })).toBe(`/${T}/configuracoes/carreira/professor`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'professor', trilhaAba: 'metas' })).toBe(`/${T}/configuracoes/carreira/professor`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'professor', trilhaAba: 'regras' })).toBe(`/${T}/configuracoes/carreira/professor/regras`);
    expect(hrefFor(T, 'settings', { sub: 'carreira', trilhaId: 'a/b' })).toBe(`/${T}/configuracoes/carreira`);
    expect(hrefFor(T, 'settings', { sub: 'team', trilhaId: 'professor' })).toBe(`/${T}/configuracoes/equipe`);
  });

  it('a trilha não entra na chave da tela nem no molde do Sentry, e o id sai do texto', () => {
    expect(screenKey(parseAppPath(`/${T}/configuracoes/carreira/professor/regras`))).toBe('settings');
    expect(routeTemplate(`/${T}/configuracoes/carreira/professor`)).toBe('/:tenant/configuracoes');
    expect(scrubLeadPath(`/${T}/configuracoes/carreira/professor/regras`)).toBe(`/${T}/configuracoes/carreira/:trilhaId/regras`);
    expect(scrubLeadPath(`/${T}/configuracoes/carreira/trilha-a1b2c3?x=1`)).toBe(`/${T}/configuracoes/carreira/:trilhaId?x=1`);
    expect(scrubLeadPath(`/${T}/configuracoes/carreira`)).toBe(`/${T}/configuracoes/carreira`);
    expect(scrubLeadPath(scrubLeadPath(`/${T}/configuracoes/carreira/professor`))).toBe(`/${T}/configuracoes/carreira/:trilhaId`);
  });

  it('o screenState devolve a trilha e a aba', () => {
    expect(screenState(parseAppPath(`/${T}/configuracoes/carreira/professor/regras`), null, gestor)).toMatchObject({
      activeTab: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'regras',
    });
    expect(screenState(parseAppPath(`/${T}/configuracoes/carreira`), null, gestor)).toMatchObject({ sub: 'carreira', trilhaId: null, trilhaAba: null });
    expect(screenState(parseAppPath(`/${T}/configuracoes/equipe`), null, gestor)).toMatchObject({ trilhaId: null, trilhaAba: null });
  });

  it('o endereço da trilha abre de primeira, e a trilha de outra academia cai na lista da sessão', () => {
    expect(decide(`/${T}/configuracoes/carreira/professor/regras`, gestor)).toEqual({ kind: 'ok' });
    expect(decide('/outra-academia/configuracoes/carreira/professor', gestor)).toMatchObject({ kind: 'redirect', to: `/${T}/configuracoes/carreira` });
  });

  it('a correção de academia leva a trilha e a aba no alvo', () => {
    expect(decide(`/STRONIX-CRM-APP/configuracoes/carreira/professor/regras`, gestor)).toMatchObject({
      kind: 'redirect',
      to: `/${T}/configuracoes/carreira/professor/regras`,
      target: { screen: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'regras' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/routes.carreira.test.js`
Expected: FAIL. O `parseAppPath` de `/configuracoes/carreira` dá `subUnknown: true`, porque `carreira` ainda não está em `SETTINGS_SECTIONS`.

- [ ] **Step 3: Add the section and read the trilha in routes.js**

Em `src/lib/routes.js`:

Troque:

```js
export const SETTINGS_SECTIONS = Object.freeze({
  overview: 'visao-geral',
  team: 'equipe',
```

por:

```js
// `carreira` é o Plano de carreira (spec 2026-11-26-plano-de-carreira-
// configuravel), só com o módulo faltosos (settingsSection). A trilha aberta e
// a aba dela são lidas à parte no readScreen.
export const SETTINGS_SECTIONS = Object.freeze({
  overview: 'visao-geral',
  team: 'equipe',
  carreira: 'carreira',
```

No `readScreen`, logo antes de `  if (own(GROUPS, head)) {`, acrescente:

```js
  if (head === 'configuracoes') {
    // A trilha do plano de carreira e a aba dela, no molde do modelo de rotina:
    // /configuracoes/carreira/<id> (Níveis e metas) e /<id>/regras. O resto
    // segue a tabela de seções.
    out.screen = 'settings';
    out.rest = segs.slice(1);
    const [secao, id, aba, ...sobra] = out.rest;
    if (lower(secao) === SETTINGS_SECTIONS.carreira && isValidLeadId(id) && sobra.length === 0
      && (aba === undefined || lower(aba) === 'regras')) {
      out.sub = 'carreira';
      out.trilhaId = id;
      out.trilhaAba = aba === undefined ? 'metas' : 'regras';
      return;
    }
    readSub('settings', out.rest, out);
    return;
  }
```

No comentário do `parseAppPath`, logo depois do parágrafo do `modelId`, acrescente:

```js
// - trilhaId e trilhaAba: a trilha aberta do plano de carreira
//   (/configuracoes/carreira/<id>, aba 'metas', ou /<id>/regras, aba
//   'regras'), com sub 'carreira'. Como o modelId, só existem quando o id passa
//   no isValidLeadId e não vem segmento a mais.
```

No `hrefFor`, troque:

```js
  const { leadId, superTab, sub, modelId, profId } = opts || {};
```

por:

```js
  const { leadId, superTab, sub, modelId, profId, trilhaId, trilhaAba } = opts || {};
```

e, logo antes de `  if (screen === 'rotinas') {`, acrescente:

```js
  if (screen === 'settings' && sub === 'carreira') {
    // Id que não serve cai na lista das trilhas, como o modelo de rotina.
    const tid = isValidLeadId(trilhaId) ? encode(trilhaId) : null;
    if (tid !== null) return `${base}/configuracoes/carreira/${tid}${trilhaAba === 'regras' ? '/regras' : ''}`;
  }
```

No `redirectTo`, troque:

```js
  return { kind: 'redirect', to: path + search, target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab, sub: r.sub, ...(r.modelId ? { modelId: r.modelId } : {}), ...(r.profId ? { profId: r.profId } : {}) }, notice };
```

por:

```js
  return { kind: 'redirect', to: path + search, target: { screen: r.screen, leadId: r.leadId, superTab: r.superTab, sub: r.sub, ...(r.modelId ? { modelId: r.modelId } : {}), ...(r.profId ? { profId: r.profId } : {}), ...(r.trilhaId ? { trilhaId: r.trilhaId, trilhaAba: r.trilhaAba } : {}) }, notice };
```

No `sessionPathFor`, troque:

```js
  if (route.modelId) return joinPath(base, SCREENS[route.screen].segs);
```

por:

```js
  if (route.modelId) return joinPath(base, SCREENS[route.screen].segs);
  // A trilha de carreira também é dado de lá: cai na lista das trilhas.
  if (route.trilhaId) return joinPath(base, [...SCREENS.settings.segs, SETTINGS_SECTIONS.carreira]);
```

- [ ] **Step 4: Return the trilha from screenState**

Em `src/lib/appShell.js`, troque:

```js
    profId: shown?.screen === 'professorPerfil' ? (shown.profId ?? null) : null,
  };
```

por:

```js
    profId: shown?.screen === 'professorPerfil' ? (shown.profId ?? null) : null,
    // A trilha aberta do plano de carreira e a aba dela (Configurações).
    trilhaId: shown?.screen === 'settings' ? (shown.trilhaId ?? null) : null,
    trilhaAba: shown?.screen === 'settings' && shown.trilhaId ? (shown.trilhaAba ?? 'metas') : null,
  };
```

- [ ] **Step 5: Scrub the trilha id for Sentry**

Em `src/lib/sentryScrub.js`, troque:

```js
// E o id do professor do perfil (/professores/perfil/<id>).
const PROF_PATH_RE = /(\/professores\/perfil\/)[^/?#\s"'<>]+/gi;

export function scrubLeadPath(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(LEAD_PATH_RE, '$1:leadId').replace(MODEL_PATH_RE, '$1:modelId').replace(PROF_PATH_RE, '$1:profId');
}
```

por:

```js
// E o id do professor do perfil (/professores/perfil/<id>).
const PROF_PATH_RE = /(\/professores\/perfil\/)[^/?#\s"'<>]+/gi;
// E o id da trilha do plano de carreira (/configuracoes/carreira/<id>).
const TRILHA_PATH_RE = /(\/configuracoes\/carreira\/)[^/?#\s"'<>]+/gi;

export function scrubLeadPath(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(LEAD_PATH_RE, '$1:leadId')
    .replace(MODEL_PATH_RE, '$1:modelId')
    .replace(PROF_PATH_RE, '$1:profId')
    .replace(TRILHA_PATH_RE, '$1:trilhaId');
}
```

- [ ] **Step 6: Run the route tests**

Run: `npx vitest run src/lib/__tests__/routes.carreira.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.professores.test.js src/lib/__tests__/appShell.test.js src/lib/__tests__/sentryScrub.test.js src/lib/__tests__/tenantSlug.test.js`
Expected: PASS. `carreira` não é primeiro segmento, então não entra em `RESERVED_TENANT_SLUGS` neste PR.

- [ ] **Step 7: Commit**

```bash
git add src/lib/routes.js src/lib/appShell.js src/lib/sentryScrub.js src/lib/__tests__/routes.carreira.test.js
git commit -m "feat: trilha de carreira no endereço das Configurações"
```

---

### Task 5: o item Plano de carreira no trilho

**Files:**
- Modify: `src/lib/settingsRail.js`
- Modify: `src/views/settings/settingsRailIcons.js`
- Modify: `src/lib/__tests__/settingsRail.test.js`
- Modify: `src/lib/__tests__/settingsRail.behavior.test.js:40`

- [ ] **Step 1: Write the failing test**

Em `src/lib/__tests__/settingsRail.test.js`:

Troque:

```js
const idsDo = (canImport) => settingsRailGroups(canImport).flatMap((g) => g.items.map((i) => i.id));
```

por:

```js
const MOD = ['faltosos'];
const idsDo = (canImport, modulos = MOD) => settingsRailGroups(canImport, modulos).flatMap((g) => g.items.map((i) => i.id));
```

Troque:

```js
    expect(settingsRailGroups(true)).toBe(SETTINGS_RAIL_GROUPS);
```

por:

```js
    expect(settingsRailGroups(true, MOD)).toBe(SETTINGS_RAIL_GROUPS);
```

Troque:

```js
    expect(settingsRailGroups(false).find((g) => g.id === 'base').items.map((i) => i.id)).toEqual(['transfer', 'referral-owners']);
```

por:

```js
    expect(settingsRailGroups(false, MOD).find((g) => g.id === 'base').items.map((i) => i.id)).toEqual(['transfer', 'referral-owners']);
```

E, logo antes do teste `'sem a sessão assumida, /configuracoes/importacao desenha a seção padrão'`, acrescente:

```js
  // O plano de carreira mora atrás do módulo da STRONIX (Stronix 2.0, chave
  // faltosos), como as telas de professores.
  it('Plano de carreira só aparece com o módulo, logo depois de Equipe & acessos', () => {
    const equipe = (modulos) => settingsRailGroups(false, modulos).find((g) => g.id === 'equipe').items.map((i) => i.label);
    expect(equipe(MOD)).toEqual(['Equipe & acessos', 'Plano de carreira']);
    expect(equipe([])).toEqual(['Equipe & acessos']);
    expect(equipe(undefined)).toEqual(['Equipe & acessos']);
    expect(idsDo(true, [])).not.toContain('carreira');
    expect(hrefFor(T, 'settings', { sub: 'carreira' })).toBe(`/${T}/configuracoes/carreira`);
  });

  it('sem o módulo, /configuracoes/carreira desenha a seção padrão', () => {
    expect(settingsSection('carreira', false, [])).toBe(SETTINGS_DEFAULT_SECTION);
    expect(settingsSection('carreira', true)).toBe(SETTINGS_DEFAULT_SECTION);
    expect(settingsSection('carreira', false, MOD)).toBe('carreira');
  });
```

Em `src/lib/__tests__/settingsRail.behavior.test.js`, troque:

```js
const groups = settingsRailGroups(true);
```

por:

```js
const groups = settingsRailGroups(true, ['faltosos']);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/settingsRail.test.js`
Expected: FAIL. O grupo Equipe só tem "Equipe & acessos", e `settingsSection('carreira', false, [])` devolve `'carreira'`.

- [ ] **Step 3: Add the item and the module filter**

Em `src/lib/settingsRail.js`:

Troque:

```js
import { SCREENS } from './routes.js';
```

por:

```js
import { SCREENS } from './routes.js';
import { MODULES, hasModule } from './modules.js';
```

Troque:

```js
// `id` do grupo é a chave do resumo (railSummaries) e do ícone. `soAssumida`
// marca o item que só existe na sessão assumida do super console. `screen`
```

por:

```js
// `id` do grupo é a chave do resumo (railSummaries) e do ícone. `soAssumida`
// marca o item que só existe na sessão assumida do super console, e `modulo`,
// o que só existe com o módulo da academia (o Plano de carreira). `screen`
```

Troque:

```js
  { id: 'equipe', label: 'Equipe', items: [{ id: 'team', label: 'Equipe & acessos' }] },
```

por:

```js
  {
    id: 'equipe',
    label: 'Equipe',
    items: [
      { id: 'team', label: 'Equipe & acessos' },
      { id: 'carreira', label: 'Plano de carreira', modulo: MODULES.FALTOSOS },
    ],
  },
```

Troque as duas funções do fim do arquivo:

```js
// Trilho desta sessão. Importar clientes só existe na sessão assumida do super
// console (spec 2026-09-03), então sem ela o item some do trilho.
export function settingsRailGroups(canImport) {
  if (canImport) return SETTINGS_RAIL_GROUPS;
  return SETTINGS_RAIL_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.soAssumida) }))
    .filter((g) => g.items.length > 0);
}

// Seção que a tela realmente desenha. O endereço pede uma seção, mas Importar
// clientes só existe na sessão assumida: sem ela, /configuracoes/importacao
// deixaria o lado direito em branco. Cai na seção padrão, do mesmo jeito calado
// que uma sub-tela desconhecida cai na tela-mãe. O endereço não é reescrito:
// ele se acerta no primeiro clique do trilho.
export function settingsSection(section, canImport) {
  return section === 'import' && !canImport ? SETTINGS_DEFAULT_SECTION : section;
}
```

por:

```js
// O item vale nesta sessão: Importar clientes só na sessão assumida do super
// console (spec 2026-09-03), e o Plano de carreira só com o módulo.
const itemVale = (item, canImport, modules) => (!item.soAssumida || canImport)
  && (!item.modulo || hasModule(modules, item.modulo));

// Trilho desta sessão, com os itens que valem. `modules` é a lista da academia
// (appUser.tenantModules).
export function settingsRailGroups(canImport, modules = []) {
  if (SETTINGS_RAIL_GROUPS.every((g) => g.items.every((it) => itemVale(it, canImport, modules)))) return SETTINGS_RAIL_GROUPS;
  return SETTINGS_RAIL_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => itemVale(it, canImport, modules)) }))
    .filter((g) => g.items.length > 0);
}

// Seção que a tela realmente desenha. O endereço pede uma seção, mas Importar
// clientes só existe na sessão assumida e o Plano de carreira só com o módulo:
// sem isso, o lado direito ficaria em branco. Cai na seção padrão, do mesmo
// jeito calado que uma sub-tela desconhecida cai na tela-mãe. O endereço não é
// reescrito: ele se acerta no primeiro clique do trilho.
export function settingsSection(section, canImport, modules = []) {
  const item = SETTINGS_RAIL_GROUPS.flatMap((g) => g.items).find((it) => it.id === section);
  return item && !itemVale(item, canImport, modules) ? SETTINGS_DEFAULT_SECTION : section;
}
```

Em `src/views/settings/settingsRailIcons.js`, troque:

```js
import {
  ArrowRightLeft, ArrowUpRight, Building2, CalendarClock, CreditCard, FileSpreadsheet, Gauge,
  Handshake, Kanban, Library, ListChecks, PlugZap, Target, Users, Wrench,
} from 'lucide-react';
```

por:

```js
import {
  ArrowRightLeft, ArrowUpRight, Building2, CalendarClock, CreditCard, FileSpreadsheet, Gauge,
  Handshake, Kanban, Library, ListChecks, PlugZap, Target, TrendingUp, Users, Wrench,
} from 'lucide-react';
```

e troque:

```js
  team: Users,
```

por:

```js
  team: Users,
  carreira: TrendingUp,
```

- [ ] **Step 4: Run the rail tests**

Run: `npx vitest run src/lib/__tests__/settingsRail.test.js src/lib/__tests__/settingsRail.behavior.test.js src/lib/__tests__/routes.test.js`
Expected: PASS. O teste de comportamento conta os links pela lista inteira (`SETTINGS_RAIL_GROUPS`), e o trilho montado agora tem o módulo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settingsRail.js src/views/settings/settingsRailIcons.js src/lib/__tests__/settingsRail.test.js src/lib/__tests__/settingsRail.behavior.test.js
git commit -m "feat: Plano de carreira no trilho das Configurações, com o módulo"
```

---

### Task 6: textos e campo de número do editor

**Files:**
- Create: `src/views/settings/carreira/carreiraTexto.js`
- Create: `src/views/settings/carreira/CampoNumero.jsx`
- Create: `src/lib/__tests__/carreiraTexto.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreiraTexto.test.js`:

```js
// Os textos do editor de Configurações → Plano de carreira (plano
// 2026-11-26-plano-de-carreira-02, tarefa 6).
import { describe, it, expect } from 'vitest';
import { NUMEROS } from '../carreira/numeros.js';
import { trilhasDe } from '../carreira/trilhas.js';
import { com, novaTrilha } from '../carreira/rascunho.js';
import {
  lerNumero, NUMERO_UI, numerosContamTexto, numeroParaTexto, paraQuemTexto, periodoTexto, pessoasTexto, quandoTexto, unidadeDe,
} from '../../views/settings/carreira/carreiraTexto.js';

const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);

describe('textos da trilha', () => {
  it('para quem', () => {
    expect(paraQuemTexto(PROFESSOR)).toBe('Para professores formados');
    expect(paraQuemTexto(ESTAGIARIO)).toBe('Para estagiários');
    expect(paraQuemTexto(CONSULTOR)).toBe('Para consultores');
    expect(paraQuemTexto(novaTrilha('professor', [], () => 0))).toBe('Para professores');
  });

  it('quando avalia e o período, no anual e no semestral', () => {
    expect(quandoTexto(PROFESSOR)).toBe('Avaliação em dezembro');
    expect(quandoTexto(ESTAGIARIO)).toBe('Avaliação em junho e dezembro');
    expect(periodoTexto(PROFESSOR)).toBe('Os números contam de 1º de dezembro a 30 de novembro.');
    expect(periodoTexto(com(PROFESSOR, { mes: 3 }))).toBe('Os números contam de 1º de março a 28 ou 29 de fevereiro.');
    expect(periodoTexto(ESTAGIARIO)).toBe('Os números contam de 1º de dezembro a 31 de maio e de 1º de junho a 30 de novembro.');
    expect(periodoTexto(com(ESTAGIARIO, { mes: 1 }))).toBe('Os números contam de 1º de julho a 31 de dezembro e de 1º de janeiro a 30 de junho.');
  });

  it('pessoas e números', () => {
    expect([0, 1, 7].map(pessoasTexto)).toEqual(['ninguém', '1 pessoa', '7 pessoas']);
    expect([0, 1, 4].map(numerosContamTexto)).toEqual(['Nenhum número conta', '1 número conta', '4 números contam']);
  });
});

describe('números da grade', () => {
  it('todo número da lista tem ícone, legenda e regra', () => {
    for (const id of Object.keys(NUMEROS)) {
      expect(NUMERO_UI[id]?.icone, id).toBeTruthy();
      expect(typeof NUMERO_UI[id].legenda({}), id).toBe('string');
      expect(NUMERO_UI[id].regra, id).toBeTruthy();
    }
    expect(Object.keys(NUMERO_UI).sort()).toEqual(Object.keys(NUMEROS).sort());
  });

  it('a legenda segue o ajuste da trilha', () => {
    expect(NUMERO_UI.aderencia.legenda({ barra: 3 })).toBe('semanas com 3 aulas ou mais');
    expect(NUMERO_UI.vendas.legenda({ vendasEm: 'reais' })).toBe('valor fechado, média por mês');
    expect(NUMERO_UI.vendas.legenda({ vendasEm: 'quantidade' })).toBe('vendas fechadas, média por mês');
  });

  it('a unidade dentro do campo; vendas em reais mostram mil e gravam reais', () => {
    expect(unidadeDe('renovacao', {})).toEqual({ depois: '% ou mais' });
    expect(unidadeDe('nps', {})).toEqual({ depois: 'ou mais' });
    expect(unidadeDe('conversao', {})).toEqual({ depois: 'pts' });
    expect(unidadeDe('metaDiaria', {})).toEqual({ depois: '% dos dias' });
    expect(unidadeDe('vendas', { vendasEm: 'reais' })).toEqual({ antes: 'R$', depois: 'mil', escala: 1000 });
    expect(unidadeDe('vendas', { vendasEm: 'quantidade' })).toEqual({ depois: 'por mês' });
  });
});

describe('leitura do número digitado', () => {
  it('vazio é sem valor, vírgula é decimal e o resto não é número', () => {
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('  ')).toBeNull();
    expect(lerNumero('45')).toBe(45);
    expect(lerNumero('9,5')).toBe(9.5);
    expect(lerNumero('-3')).toBe(-3);
    expect(Number.isNaN(lerNumero('9,'))).toBe(false);
    expect(Number.isNaN(lerNumero('abc'))).toBe(true);
  });

  it('o texto do número usa vírgula', () => {
    expect(numeroParaTexto(null)).toBe('');
    expect(numeroParaTexto(Number.NaN)).toBe('');
    expect(numeroParaTexto(9.5)).toBe('9,5');
    expect(numeroParaTexto(12)).toBe('12');
  });
});
```

`lerNumero('9,')` dá `9`, porque `Number('9.')` é 9: o campo aceita o "9," no meio da digitação.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreiraTexto.test.js`
Expected: FAIL, "Failed to resolve import ../../views/settings/carreira/carreiraTexto.js".

- [ ] **Step 3: Write the texts module**

Crie `src/views/settings/carreira/carreiraTexto.js`:

```js
// Os textos, os ícones e as classes compartilhadas do editor de
// Configurações → Plano de carreira (mockup A,
// docs/superpowers/specs/mockups/2026-11-26-carreira-editor-a.html). JS sem
// JSX, como o settingsRailIcons.js: o teste lê os textos sem montar tela, e o
// react-refresh não aceita .jsx exportando constante.
import {
  BadgeDollarSign, Banknote, CalendarCheck, GraduationCap, RefreshCw, Star, Target, UserCheck,
} from 'lucide-react';
import { mesesDaAvaliacao } from '../../../lib/carreira/periodo.js';

export const MESES = Object.freeze(['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']);
export const maiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// A trava do PR 2 (visão geral do plano de carreira): o NPS das telas de
// professores já lê a trilha Professor, e os outros números ainda usam o ciclo
// fixo de dezembro. O PR 3 tira a trava.
export const AVISO_CALENDARIO_PROFESSOR = 'O calendário da trilha Professor muda a partir do menu Carreira.';

// O desenho de cada base: o ícone e os tons do ícone grande, do degrau e do
// quadrado de cada número.
export const BASE_UI = Object.freeze({
  professor: Object.freeze({
    icone: GraduationCap,
    fundo: 'bg-linear-to-br from-brand-600 to-brand-400',
    degrau: 'bg-brand-600',
    tile: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  }),
  consultor: Object.freeze({
    icone: BadgeDollarSign,
    fundo: 'bg-linear-to-br from-accent-500 to-accent-400',
    degrau: 'bg-accent-500',
    tile: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400',
  }),
});

// Ícone, legenda curta da grade (pelos ajustes da trilha) e o texto de "Como
// cada número conta". O nome é o de NUMEROS (src/lib/carreira/numeros.js).
export const NUMERO_UI = Object.freeze({
  renovacao: {
    icone: RefreshCw,
    legenda: () => 'alunos que renovaram',
    regra: 'Dos alunos do professor cujo contrato venceu no período, quantos renovaram.',
  },
  nps: {
    icone: Star,
    legenda: () => 'média da pesquisa, de 0 a 10',
    regra: 'A média da pergunta principal da pesquisa. A pesquisa só vale com 10 respostas ou mais e com metade da turma.',
  },
  conversao: {
    icone: UserCheck,
    legenda: () => 'pontos acima da academia',
    regra: 'Das pessoas que vieram à aula experimental ou ao freepass com o professor, quantas se matricularam, comparado com a conversão da academia inteira. Com 0 pontos, passa quem fica acima da academia.',
  },
  aderencia: {
    icone: CalendarCheck,
    legenda: (a) => `semanas com ${a?.barra ?? 2} aulas ou mais`,
    regra: 'Das semanas dos alunos, de segunda a sexta, em quantas o aluno veio o bastante.',
  },
  consultorConversao: {
    icone: UserCheck,
    legenda: () => 'pontos acima da academia',
    regra: 'Dos leads do consultor cadastrados no período, quantos se matricularam, comparado com a conversão da academia inteira.',
  },
  vendas: {
    icone: Banknote,
    legenda: (a) => (a?.vendasEm === 'quantidade' ? 'vendas fechadas, média por mês' : 'valor fechado, média por mês'),
    regra: 'Matrículas e renovações que o consultor fechou, somadas e divididas pelos meses do período. É o valor do contrato, não o que entrou no caixa.',
  },
  consultorRenovacao: {
    icone: RefreshCw,
    legenda: () => 'clientes que renovaram',
    regra: 'Dos clientes de que o consultor é dono hoje, cujo contrato venceu no período, quantos renovaram.',
  },
  metaDiaria: {
    icone: Target,
    legenda: () => 'dias de meta batidos',
    regra: 'Dos dias de meta do período, em quantos o consultor bateu a Meta diária.',
  },
});

// A unidade dentro do campo da meta. As vendas em reais aparecem em mil reais
// e gravam em reais (escala).
export function unidadeDe(id, ajustes) {
  if (id === 'conversao' || id === 'consultorConversao') return { depois: 'pts' };
  if (id === 'nps') return { depois: 'ou mais' };
  if (id === 'metaDiaria') return { depois: '% dos dias' };
  if (id === 'vendas') return ajustes?.vendasEm === 'quantidade' ? { depois: 'por mês' } : { antes: 'R$', depois: 'mil', escala: 1000 };
  return { depois: '% ou mais' };
}

export function paraQuemTexto(t) {
  if (t.base === 'consultor') return 'Para consultores';
  if (t.sugestao?.vinculo === 'estagio') return 'Para estagiários';
  if (t.sugestao?.vinculo === 'formado') return 'Para professores formados';
  return 'Para professores';
}

export const pessoasTexto = (n) => (n === 0 ? 'ninguém' : n === 1 ? '1 pessoa' : `${n} pessoas`);
export const numerosContamTexto = (n) => (n === 0 ? 'Nenhum número conta' : n === 1 ? '1 número conta' : `${n} números contam`);

export function quandoTexto(t) {
  const [a, b] = mesesDaAvaliacao(t);
  return b ? `Avaliação em ${MESES[a - 1]} e ${MESES[b - 1]}` : `Avaliação em ${MESES[a - 1]}`;
}

const fimDoMes = (m) => (m === 2 ? '28 ou 29 de fevereiro' : `${new Date(2001, m, 0).getDate()} de ${MESES[m - 1]}`);
// O trecho que termina no fim do mês antes da avaliação `m` e dura `meses`.
const trecho = (m, meses) => `de 1º de ${MESES[(m - 1 - meses + 24) % 12]} a ${fimDoMes(m === 1 ? 12 : m - 1)}`;

// Os períodos da trilha (src/lib/carreira/periodo.js), por extenso.
export function periodoTexto(t) {
  const [a, b] = mesesDaAvaliacao(t);
  return b
    ? `Os números contam ${trecho(a, 6)} e ${trecho(b, 6)}.`
    : `Os números contam ${trecho(a, 12)}.`;
}

// Vazio é sem valor (null); o que não é número vira NaN, que o
// problemaDaTrilha recusa. Vírgula vale como decimal.
export function lerNumero(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  return t === '' ? null : Number(t);
}
export const numeroParaTexto = (v) => (v == null || Number.isNaN(v) ? '' : String(v).replace('.', ','));

// Os botões do editor e da lista. O principal tem fundo azul sólido, então o
// anel do foco leva a folga (anelDeFoco.test.js).
export const BOTAO_PRIMARIO = 'inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white outline-none hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
export const BOTAO_SECUNDARIO = 'inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-semibold outline-none hover:bg-muted focus-visible:anel-foco disabled:cursor-not-allowed disabled:opacity-50';
```

- [ ] **Step 4: Write the number field**

Crie `src/views/settings/carreira/CampoNumero.jsx`:

```jsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { lerNumero, numeroParaTexto } from './carreiraTexto.js';

// O campo das metas e do tempo mínimo (mockup A): a unidade mora dentro dele
// ("45 % ou mais", "R$ 12 mil"), e o campo em branco fica tracejado com "sem
// meta". O texto digitado fica aqui, e o rascunho recebe o número: null quando
// vazio, NaN quando não é número. `escala` mostra o valor dividido (vendas em
// mil reais) e devolve multiplicado. Quando o valor muda por fora (Descartar),
// o texto acompanha, sem perder o "9," do meio da digitação.
export function CampoNumero({ valor, onValor, antes, depois, escala = 1, rotulo, vazio = 'sem meta', className }) {
  const mostrado = valor == null || Number.isNaN(valor) ? valor : valor / escala;
  const [texto, setTexto] = useState(() => numeroParaTexto(mostrado));
  const [visto, setVisto] = useState(mostrado);
  if (!Object.is(visto, mostrado)) {
    setVisto(mostrado);
    if (!Object.is(lerNumero(texto), mostrado)) setTexto(numeroParaTexto(mostrado));
  }
  const emBranco = texto.trim() === '';
  const invalido = Number.isNaN(lerNumero(texto));

  function mudar(e) {
    const n = lerNumero(e.target.value);
    setTexto(e.target.value);
    onValor(n == null || Number.isNaN(n) ? n : Math.round(n * escala * 100) / 100);
  }

  return (
    <label
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-[11px] border bg-card px-[11px] transition-colors focus-within:border-brand-600 focus-within:anel-foco motion-reduce:transition-none',
        emBranco ? 'border-dashed border-border bg-muted/30' : 'border-border',
        invalido && 'border-rose-500',
        className,
      )}
    >
      {antes && <em className="text-[12.5px] font-medium not-italic text-foreground/80">{antes}</em>}
      <input
        inputMode="decimal"
        value={texto}
        placeholder={vazio}
        aria-label={rotulo}
        aria-invalid={invalido || undefined}
        onChange={mudar}
        className={cn(
          'border-0 bg-transparent p-0 text-right text-[15px] font-semibold tabular-nums outline-none placeholder:text-[13px] placeholder:font-medium placeholder:text-muted-foreground/70',
          emBranco && vazio ? 'w-[62px]' : 'w-12',
        )}
      />
      {depois && <em className="whitespace-nowrap text-[12.5px] not-italic text-muted-foreground">{depois}</em>}
    </label>
  );
}
```

- [ ] **Step 5: Run the test and lint**

Run: `npx vitest run src/lib/__tests__/carreiraTexto.test.js && npx eslint src/views/settings/carreira/`
Expected: PASS e lint sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/views/settings/carreira/carreiraTexto.js src/views/settings/carreira/CampoNumero.jsx src/lib/__tests__/carreiraTexto.test.js
git commit -m "feat: textos e campo de número do editor de trilha"
```

---

### Task 7: o editor da trilha (grade, regras e barra de salvar)

**Files:**
- Create: `src/views/settings/carreira/TrilhaGrade.jsx`
- Create: `src/views/settings/carreira/TrilhaRegras.jsx`
- Create: `src/views/settings/carreira/TrilhaEditor.jsx`
- Create: `src/lib/__tests__/carreiraEditor.behavior.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreiraEditor.behavior.test.js`:

```js
// @vitest-environment jsdom
// O editor da trilha (plano 2026-11-26-plano-de-carreira-02, tarefa 7): a
// grade de níveis e metas, as regras, a barra de salvar e a trava do
// calendário da trilha Professor até o PR 3.
import { act, createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));

const { trilhasDe } = await import('../carreira/trilhas.js');
const { MOTIVO_DO_ARQUIVAR, novaTrilha, SEM_NIVEL } = await import('../carreira/rascunho.js');
const { AVISO_CALENDARIO_PROFESSOR } = await import('../../views/settings/carreira/carreiraTexto.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { TrilhaEditor } = await import('../../views/settings/carreira/TrilhaEditor.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);
const GENTE = { junior: 2, pleno: 1, senior: 0, [SEM_NIVEL]: 0 };
const NINGUEM = { junior: 0, pleno: 0, senior: 0, [SEM_NIVEL]: 0 };

const ed = { aba: null };
function Editor({ abaInicial = 'metas', ...props }) {
  const [aba, setAba] = useState(abaInicial);
  useEffect(() => { ed.aba = aba; });
  return h(TrilhaEditor, {
    outras: [], voltarHref: '/acad/configuracoes/carreira', modalities: [{ id: 'func', name: 'Funcional' }],
    onSalvar: vi.fn(async () => {}), onArquivar: vi.fn(), onDescartarNova: vi.fn(),
    ...props, aba, onAba: setAba,
  });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  ed.aba = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async (props) => {
  await act(async () => {
    root.render(h(MemoryRouter, null, h(ToastContext.Provider, { value: toast }, h(Editor, props))));
  });
};
const campo = (rotulo) => document.body.querySelector(`input[aria-label="${rotulo}"]`);
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === rotulo || b.textContent.trim() === rotulo);
const radio = (texto) => [...document.body.querySelectorAll('[role="radio"]')].find((r) => r.textContent.trim() === texto);
const aba = (texto) => [...document.body.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === texto);
const status = () => document.body.querySelector('[role="status"]').textContent;
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
// O Radix troca de aba no mousedown do botão esquerdo, e não no click.
const mousedown = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const digitar = async (el, v) => {
  expect(el).toBeTruthy();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('a grade de níveis e metas', () => {
  it('meta em branco fica tracejada com "sem meta", e a barra conta as que faltam', async () => {
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM });
    const vendas = campo('Vendas, Júnior');
    expect(vendas.value).toBe('');
    expect(vendas.placeholder).toBe('sem meta');
    expect(vendas.closest('label').className).toContain('border-dashed');
    expect(status()).toBe('12 metas em branco. A trilha salva assim.');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });

  it('desligar o número ocupa a linha com "Não conta nesta trilha" e tira as metas da conta', async () => {
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM });
    await clicar(botao('Vendas conta nesta trilha'));
    expect(campo('Vendas, Júnior')).toBeNull();
    expect(document.body.textContent).toContain('Não conta nesta trilha');
    expect(status()).toBe('9 metas em branco. A trilha salva assim.');
    expect(botao('Salvar trilha').disabled).toBe(false);
    await clicar(botao('Vendas conta nesta trilha'));
    expect(campo('Vendas, Júnior')).toBeTruthy();
  });

  it('vendas em reais: o campo é em mil e a meta vai em reais', async () => {
    const onSalvar = vi.fn(async () => {});
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM, onSalvar });
    expect(campo('Vendas, Júnior').closest('label').textContent).toContain('R$');
    await digitar(campo('Vendas, Júnior'), '12,5');
    await clicar(botao('Salvar trilha'));
    expect(onSalvar.mock.calls[0][0].numeros.vendas.metas.junior).toBe(12500);
    expect(toast.success).toHaveBeenCalledWith('Trilha salva.');
  });

  it('apagar nível com gente fica desligado com o motivo; sem gente, apaga', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    expect(botao('Apagar o nível Júnior').getAttribute('aria-disabled')).toBe('true');
    await clicar(botao('Apagar o nível Júnior'));
    expect(toast.warning).toHaveBeenCalledWith('Júnior tem gente. Passe as pessoas para outro nível antes de apagar.');
    expect(campo('Nome do nível 1').value).toBe('Júnior');
    expect(botao('Apagar o nível Sênior').getAttribute('aria-disabled')).toBeNull();
    await clicar(botao('Apagar o nível Sênior'));
    expect(campo('Nome do nível 3')).toBeNull();
    expect(campo('Meses mínimos em Pleno antes de subir')).toBeNull();
    expect(document.body.textContent).toContain('último nível');
  });

  it('"+ Nível" acrescenta uma coluna no fim', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await clicar(botao('Acrescentar nível'));
    expect(campo('Nome do nível 4').value).toBe('Nível 4');
    expect(campo('Meses mínimos em Sênior antes de subir').value).toBe('12');
    expect(campo('Renovação da carteira, Nível 4').placeholder).toBe('sem meta');
  });

  it('renomear o nível muda o rótulo dos campos da coluna', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Nome do nível 2'), 'Pleno I');
    expect(campo('Renovação da carteira, Pleno I').value).toBe('55');
  });
});

describe('o rascunho e a barra de salvar', () => {
  it('trocar de aba não perde o que foi digitado', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await mousedown(aba('Regras da trilha'));
    expect(ed.aba).toBe('regras');
    expect(document.body.textContent).toContain('Como cada número conta');
    expect(campo('Renovação da carteira, Júnior')).toBeNull();
    await mousedown(aba('Níveis e metas'));
    expect(campo('Renovação da carteira, Júnior').value).toBe('50');
    expect(botao('Salvar trilha').disabled).toBe(false);
  });

  it('Descartar volta ao que está gravado', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    expect(botao('Descartar').disabled).toBe(true);
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    expect(status()).toBe('Tudo certo para salvar.');
    await clicar(botao('Descartar'));
    expect(campo('Renovação da carteira, Júnior').value).toBe('45');
    expect(botao('Salvar trilha').disabled).toBe(true);
    expect(status()).toBe('Nenhuma mudança ainda.');
  });

  it('Salvar manda o rascunho inteiro', async () => {
    const onSalvar = vi.fn(async () => {});
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, onSalvar });
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await clicar(botao('Salvar trilha'));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const enviado = onSalvar.mock.calls[0][0];
    expect(enviado.id).toBe('professor');
    expect(enviado.numeros.renovacao.metas).toEqual({ junior: 50, pleno: 55, senior: 65 });
  });

  it('a falha ao salvar vira aviso, com o texto da tela quando há', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSalvar = vi.fn(async () => { throw Object.assign(new Error('Já existe uma trilha com esse nome.'), { paraTela: true }); });
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, onSalvar });
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await clicar(botao('Salvar trilha'));
    expect(toast.error).toHaveBeenCalledWith('Já existe uma trilha com esse nome.');
    onSalvar.mockImplementation(async () => { throw new Error('rede'); });
    await clicar(botao('Salvar trilha'));
    expect(toast.error).toHaveBeenLastCalledWith('Não deu para salvar a trilha. Tente de novo.');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('nome vazio: a barra diz o que falta e o Salvar fica desligado', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Nome da trilha'), '');
    expect(status()).toBe('Dê um nome à trilha.');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });

  it('meta fora do limite: a barra diz o limite', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE });
    await digitar(campo('Nota dos alunos, Júnior'), '11');
    expect(status()).toBe('Use um número de 0 a 10.');
    expect(botao('Salvar trilha').disabled).toBe(true);
  });
});

describe('arquivar e a trilha nova', () => {
  it('Arquivar trilha com gente fica desligado com o motivo', async () => {
    const onArquivar = vi.fn();
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, onArquivar });
    const arquivar = botao('Arquivar trilha');
    expect(arquivar.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(arquivar.getAttribute('aria-describedby')).textContent).toBe(MOTIVO_DO_ARQUIVAR);
    await clicar(arquivar);
    expect(toast.warning).toHaveBeenCalledWith(MOTIVO_DO_ARQUIVAR);
    expect(onArquivar).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('3 pessoas nesta trilha');
  });

  it('Arquivar trilha sem gente chama o arquivar', async () => {
    const onArquivar = vi.fn();
    await render({ inicial: CONSULTOR, gravada: CONSULTOR, pessoas: NINGUEM, onArquivar });
    expect(document.body.textContent).toContain('Ninguém nesta trilha');
    await clicar(botao('Arquivar trilha'));
    expect(onArquivar).toHaveBeenCalledTimes(1);
  });

  it('a trilha nova não tem Arquivar, e Descartar chama o descarte', async () => {
    const onDescartarNova = vi.fn();
    await render({ inicial: novaTrilha('professor', [], () => 0), gravada: null, pessoas: {}, onDescartarNova });
    expect(botao('Arquivar trilha')).toBeUndefined();
    expect(campo('Nome da trilha').value).toBe('');
    expect(botao('Salvar trilha').disabled).toBe(true);
    await clicar(botao('Descartar'));
    expect(onDescartarNova).toHaveBeenCalledTimes(1);
  });
});

describe('as regras da trilha', () => {
  // A trava do PR 2: o PR 3 a tira, junto com este teste.
  it('a trilha Professor trava a frequência e o mês, com o aviso', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, abaInicial: 'regras' });
    expect(document.body.textContent).toContain(AVISO_CALENDARIO_PROFESSOR);
    expect(radio('Uma vez por ano').disabled).toBe(true);
    expect(radio('Duas vezes por ano').disabled).toBe(true);
    expect(document.body.querySelector('button[aria-label="Mês da avaliação"]').disabled).toBe(true);
    expect(document.body.textContent).toContain('Os números contam de 1º de dezembro a 30 de novembro.');
  });

  it('com gente na trilha, "Para quem" não muda', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, abaInicial: 'regras' });
    expect(radio('Professores').disabled).toBe(true);
    expect(radio('Consultores').disabled).toBe(true);
    expect(document.body.textContent).toContain('não muda com gente na trilha');
  });

  it('as outras trilhas mudam o calendário', async () => {
    await render({ inicial: ESTAGIARIO, gravada: ESTAGIARIO, pessoas: NINGUEM, abaInicial: 'regras' });
    expect(document.body.textContent).not.toContain(AVISO_CALENDARIO_PROFESSOR);
    expect(radio('Uma vez por ano').disabled).toBe(false);
    expect(document.body.querySelector('button[aria-label="Meses da avaliação"]').disabled).toBe(false);
    expect(document.body.textContent).toContain('Os números contam de 1º de dezembro a 31 de maio e de 1º de junho a 30 de novembro.');
    expect(radio('12 meses até o fim do semestre').getAttribute('aria-checked')).toBe('true');
  });

  it('cada número ligado diz como conta, com o ajuste', async () => {
    await render({ inicial: PROFESSOR, gravada: PROFESSOR, pessoas: GENTE, abaInicial: 'regras' });
    expect(campo('Dias de aula recente que ainda não contam').value).toBe('30');
    expect(campo('Aulas na semana para contar').value).toBe('2');
    expect(campo('Fim da faixa da meta').value).toBe('70');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreiraEditor.behavior.test.js`
Expected: FAIL, "Failed to resolve import ../../views/settings/carreira/TrilhaEditor.jsx".

- [ ] **Step 3: Write the grade**

Crie `src/views/settings/carreira/TrilhaGrade.jsx`:

```jsx
import { Clock, Info, Plus, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { NUMEROS, numerosDaBase } from '../../../lib/carreira/numeros.js';
import { MAX_NIVEIS } from '../../../lib/carreira/trilhas.js';
import {
  acrescentarNivel, apagarNivel, ligarNumero, metasEmBranco, motivoDoApagar, renomearNivel, trocarMeses, trocarMeta,
} from '../../../lib/carreira/rascunho.js';
import { BASE_UI, NUMERO_UI, pessoasTexto, unidadeDe } from './carreiraTexto.js';
import { CampoNumero } from './CampoNumero.jsx';

// A aba Níveis e metas (mockup A refinado): os níveis no topo, desenhados como
// degraus que crescem da esquerda para a direita, o tempo mínimo na primeira
// linha e um número por linha, com o liga e desliga e um campo por nível. A
// grade rola de lado quando não cabe. `pessoas` conta quem está em cada nível
// (pessoasPorNivel), `onMudar` recebe a função que muda o rascunho e `avisar`
// mostra o motivo de um botão desligado.
const COLUNA_NOME = 280;
const COLUNA_NIVEL = 156;
const COLUNA_FIM = 120;

function Linha({ colunas, className, children }) {
  return <div style={colunas} className={cn('grid border-b border-border', className)}>{children}</div>;
}

function Celula({ children }) {
  return <div className="flex items-center border-l border-border px-[18px] py-3.5">{children}</div>;
}

function NomeDaLinha({ chave, tile, icone: Icone, nome, legenda, apagado = false }) {
  return (
    <div className="flex items-center gap-3 px-[18px] py-3.5">
      {chave ?? <span aria-hidden="true" className="w-8 flex-none" />}
      <span aria-hidden="true" className={cn('grid size-9 flex-none place-items-center rounded-[11px]', tile)}>
        <Icone size={18} />
      </span>
      <span className="min-w-0">
        <b className={cn('block text-[14px] font-semibold leading-tight', apagado && 'text-muted-foreground')}>{nome}</b>
        <small className={cn('mt-px block text-[12px] text-muted-foreground', apagado && 'text-muted-foreground/70')}>{legenda}</small>
      </span>
    </div>
  );
}

export function TrilhaGrade({ trilha, pessoas, onMudar, onRegras, avisar }) {
  const N = trilha.niveis.length;
  const ui = BASE_UI[trilha.base];
  const colunas = {
    gridTemplateColumns: `minmax(${COLUNA_NOME}px,1.35fr) repeat(${N}, minmax(${COLUNA_NIVEL}px,1fr)) ${COLUNA_FIM}px`,
    minWidth: `${COLUNA_NOME + N * COLUNA_NIVEL + COLUNA_FIM}px`,
  };
  // De 0 (primeiro nível) a 2 (último): a altura e a força do degrau.
  const degrau = (i) => (N === 1 ? 2 : (i * 2) / (N - 1));
  const brancas = metasEmBranco(trilha);
  const cheio = N >= MAX_NIVEIS;
  const motivoDoCheio = `A trilha tem no máximo ${MAX_NIVEIS} níveis.`;

  return (
    <section aria-label="Níveis e metas" className="overflow-x-auto overscroll-x-contain rounded-[18px] border border-border bg-card shadow-card">
      <div style={colunas} className="grid border-b border-border bg-muted/40">
        <div className="flex flex-col justify-end gap-0.5 p-[18px]">
          <b className="font-display text-[14px] font-bold">Os níveis</b>
          <span className="text-[12.5px] text-muted-foreground">do primeiro ao último</span>
        </div>
        {trilha.niveis.map((nivel, i) => {
          const motivo = motivoDoApagar(trilha, nivel, pessoas);
          const n = Number(pessoas?.[nivel.id]) || 0;
          const nome = nivel.nome || `nível ${i + 1}`;
          return (
            <div key={nivel.id} className="flex flex-col gap-2 border-l border-border p-[18px] pb-4">
              <div aria-hidden="true" className="flex h-[72px] items-end">
                <span
                  className={cn('relative block w-full rounded-[10px_10px_4px_4px]', ui.degrau)}
                  style={{ height: 22 + degrau(i) * 22, opacity: 0.45 + degrau(i) * 0.25 }}
                >
                  <span className="absolute bottom-1.5 left-2.5 text-[11.5px] font-bold text-white">{i + 1}</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={nivel.nome}
                  onChange={(e) => onMudar((t) => renomearNivel(t, nivel.id, e.target.value))}
                  aria-label={`Nome do nível ${i + 1}`}
                  className="-mx-1.5 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-0.5 font-display text-[18px] font-bold tracking-tight outline-none hover:bg-card focus-visible:bg-card focus-visible:anel-foco"
                />
                <button
                  type="button"
                  aria-label={`Apagar o nível ${nome}`}
                  aria-disabled={motivo ? 'true' : undefined}
                  title={motivo ?? undefined}
                  onClick={() => (motivo ? avisar(motivo) : onMudar((t) => apagarNivel(t, nivel.id)))}
                  className="grid size-7 flex-none place-items-center rounded-lg text-muted-foreground outline-none hover:bg-rose-50 hover:text-rose-700 focus-visible:anel-foco aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 text-[12.5px]', n ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
                <Users size={14} aria-hidden="true" />
                {pessoasTexto(n)}
              </span>
            </div>
          );
        })}
        <div className="flex items-end justify-center border-l border-dashed border-border p-[18px]">
          <button
            type="button"
            aria-label="Acrescentar nível"
            aria-disabled={cheio ? 'true' : undefined}
            title={cheio ? motivoDoCheio : undefined}
            onClick={() => (cheio ? avisar(motivoDoCheio) : onMudar((t) => acrescentarNivel(t)))}
            className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border-[1.5px] border-dashed border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:hover:text-brand-300"
          >
            <Plus size={15} aria-hidden="true" />
            Nível
          </button>
        </div>
      </div>

      <Linha colunas={colunas} className="bg-muted/30">
        <NomeDaLinha tile={ui.tile} icone={Clock} nome="Tempo mínimo no nível" legenda="antes de poder subir" />
        {trilha.niveis.map((nivel, i) => (
          <Celula key={nivel.id}>
            {i < N - 1 ? (
              <CampoNumero
                valor={nivel.mesesMinimos}
                onValor={(v) => onMudar((t) => trocarMeses(t, nivel.id, v))}
                depois="meses"
                vazio=""
                rotulo={`Meses mínimos em ${nivel.nome || `nível ${i + 1}`} antes de subir`}
              />
            ) : (
              <span className="text-[13px] text-muted-foreground/70">último nível</span>
            )}
          </Celula>
        ))}
        <div className="border-l border-dashed border-border" />
      </Linha>

      {numerosDaBase(trilha.base).map((id) => {
        const numero = trilha.numeros[id];
        const nome = NUMEROS[id].nome;
        const un = unidadeDe(id, trilha.ajustes);
        const chave = (
          <Switch
            checked={numero.ligado}
            onCheckedChange={(v) => onMudar((t) => ligarNumero(t, id, v))}
            aria-label={`${nome} conta nesta trilha`}
            className="focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        );
        return (
          <Linha key={id} colunas={colunas}>
            <NomeDaLinha
              chave={chave}
              tile={numero.ligado ? ui.tile : 'bg-muted text-muted-foreground/70'}
              icone={NUMERO_UI[id].icone}
              nome={nome}
              legenda={NUMERO_UI[id].legenda(trilha.ajustes)}
              apagado={!numero.ligado}
            />
            {numero.ligado ? (
              <>
                {trilha.niveis.map((nivel, i) => (
                  <Celula key={nivel.id}>
                    <CampoNumero
                      valor={numero.metas[nivel.id] ?? null}
                      onValor={(v) => onMudar((t) => trocarMeta(t, id, nivel.id, v))}
                      antes={un.antes}
                      depois={un.depois}
                      escala={un.escala}
                      rotulo={`${nome}, ${nivel.nome || `nível ${i + 1}`}`}
                    />
                  </Celula>
                ))}
                <div className="border-l border-dashed border-border" />
              </>
            ) : (
              <div style={{ gridColumn: '2 / -1' }} className="flex items-center border-l border-border bg-muted/40 px-[18px] text-[13px] text-muted-foreground">
                Não conta nesta trilha
              </div>
            )}
          </Linha>
        );
      })}

      <p className="flex items-center gap-2 bg-muted/30 px-[18px] py-3 text-[12.5px] text-muted-foreground">
        <Info size={15} aria-hidden="true" className="flex-none" />
        <span>
          {brancas > 0 && 'Meta em branco: o número aparece no placar sem dizer se bateu. '}
          Como cada número é contado está em{' '}
          <button type="button" onClick={onRegras} className="rounded font-semibold text-brand-700 underline-offset-2 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300">
            Regras da trilha
          </button>
          .
        </span>
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Write the rules tab**

Crie `src/views/settings/carreira/TrilhaRegras.jsx`:

```jsx
import { useId } from 'react';
import { Calendar, Lock, SlidersHorizontal, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NUMEROS, numerosDaBase } from '../../../lib/carreira/numeros.js';
import { mesesDaAvaliacao } from '../../../lib/carreira/periodo.js';
import { com, trocarAjuste, trocarBase, trocarFrequencia, trocarSugestao } from '../../../lib/carreira/rascunho.js';
import { AVISO_CALENDARIO_PROFESSOR, BASE_UI, maiuscula, MESES, NUMERO_UI, periodoTexto } from './carreiraTexto.js';
import { CampoNumero } from './CampoNumero.jsx';

// A aba Regras da trilha (mockup A): quem segue, quando avalia e como cada
// número conta, com o ajuste de cada um. `calendarioTravado` é a trava da
// trilha Professor até o PR 3 (AVISO_CALENDARIO_PROFESSOR).
const SEG = 'inline-flex w-max flex-wrap gap-0.5 rounded-xl bg-muted p-[3px]';
const PILULA = 'inline-flex h-8 items-center rounded-[9px] px-3.5 text-[13px] font-semibold text-muted-foreground data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-sm';
// O chip de escolha (vínculo) e o de marcar (modalidades): azul quando escolhido.
const CHIP = 'inline-flex h-9 items-center rounded-[10px] border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground outline-none hover:bg-muted focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=checked]:text-white aria-pressed:border-brand-600 aria-pressed:bg-brand-600 aria-pressed:text-white';
const AJUSTE = 'mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-foreground/80';
const VINCULOS = [['qualquer', 'Qualquer vínculo'], ['formado', 'Formados'], ['estagio', 'Estagiários']];

function Bloco({ icone: Icone, titulo, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      <h3 id={id} className="flex items-center gap-2.5 border-b border-border px-5 py-4 font-display text-[15px] font-bold">
        <Icone size={18} aria-hidden="true" className="text-brand-600 dark:text-brand-300" />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Regra({ rotulo, ajuda, children }) {
  return (
    <div className="grid gap-x-7 gap-y-1.5 border-t border-border px-5 py-4 first-of-type:border-t-0 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="text-[13.5px] font-semibold">
        {rotulo}
        {ajuda && <small className="mt-0.5 block text-[12px] font-medium text-muted-foreground">{ajuda}</small>}
      </div>
      <div className="grid content-start gap-2.5">{children}</div>
    </div>
  );
}

function Ajuste({ id, trilha, onMudar }) {
  const campo = (k, rotulo, depois) => (
    <CampoNumero valor={trilha.ajustes[k]} onValor={(v) => onMudar((t) => trocarAjuste(t, k, v))} depois={depois} vazio="" rotulo={rotulo} className="h-9" />
  );
  if (id === 'conversao') {
    return <div className={AJUSTE}>Aulas dos últimos {campo('janelaDias', 'Dias de aula recente que ainda não contam', 'dias')} ainda não contam, porque a pessoa pode se matricular depois.</div>;
  }
  if (id === 'aderencia') {
    return <div className={AJUSTE}>A semana conta com {campo('barra', 'Aulas na semana para contar', 'aulas')} ou mais. A faixa da meta vai até {campo('faixaMax', 'Fim da faixa da meta', '%')}</div>;
  }
  if (id === 'vendas') {
    return (
      <div className={AJUSTE}>
        Contar em
        <RadioGroup aria-label="Vendas contam em" value={trilha.ajustes.vendasEm} onValueChange={(v) => onMudar((t) => trocarAjuste(t, 'vendasEm', v))} className={SEG}>
          <RadioGroupOption value="reais" className={PILULA}>reais</RadioGroupOption>
          <RadioGroupOption value="quantidade" className={PILULA}>quantidade de vendas</RadioGroupOption>
        </RadioGroup>
        <span className="text-muted-foreground">Trocar apaga as metas de vendas.</span>
      </div>
    );
  }
  return null;
}

export function TrilhaRegras({ trilha, onMudar, totalDePessoas, modalities, calendarioTravado }) {
  const baseTravada = totalDePessoas > 0;
  const [primeiro] = mesesDaAvaliacao(trilha);
  const semestral = trilha.frequencia === 'semestral';
  const rotuloDoMes = semestral ? 'Meses da avaliação' : 'Mês da avaliação';
  const ui = BASE_UI[trilha.base];
  const ligados = numerosDaBase(trilha.base).filter((id) => trilha.numeros[id]?.ligado);

  return (
    <div className="flex flex-col gap-4">
      <Bloco icone={User} titulo="Quem segue">
        <Regra rotulo="Para quem">
          <div className="flex flex-wrap items-center gap-2">
            <RadioGroup aria-label="Para quem" value={trilha.base} onValueChange={(v) => onMudar((t) => trocarBase(t, v))} disabled={baseTravada} className={SEG}>
              <RadioGroupOption value="professor" className={PILULA}>Professores</RadioGroupOption>
              <RadioGroupOption value="consultor" className={PILULA}>Consultores</RadioGroupOption>
            </RadioGroup>
            {baseTravada && (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[12px] font-semibold text-muted-foreground">
                <Lock size={12} aria-hidden="true" />
                não muda com gente na trilha
              </span>
            )}
          </div>
        </Regra>
        {trilha.base === 'professor' && (
          <Regra rotulo="Sugerir para" ajuda="O gestor decide no perfil de cada pessoa.">
            <RadioGroup aria-label="Vínculo" value={trilha.sugestao.vinculo} onValueChange={(v) => onMudar((t) => trocarSugestao(t, { vinculo: v }))} className="flex flex-wrap gap-2">
              {VINCULOS.map(([v, rotulo]) => <RadioGroupOption key={v} value={v} className={CHIP}>{rotulo}</RadioGroupOption>)}
            </RadioGroup>
            {(modalities || []).length > 0 && (
              <div role="group" aria-label="Modalidades" className="flex flex-wrap gap-2">
                {modalities.map((m) => {
                  const on = trilha.sugestao.modalidadeIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onMudar((t) => trocarSugestao(t, {
                        modalidadeIds: on ? t.sugestao.modalidadeIds.filter((x) => x !== m.id) : [...t.sugestao.modalidadeIds, m.id],
                      }))}
                      className={CHIP}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[12.5px] text-muted-foreground">Sem modalidade marcada, a trilha serve para todas.</p>
          </Regra>
        )}
      </Bloco>

      <Bloco icone={Calendar} titulo="Quando avalia">
        {calendarioTravado && (
          <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {AVISO_CALENDARIO_PROFESSOR}
          </p>
        )}
        <Regra rotulo="Frequência">
          <RadioGroup aria-label="Frequência" value={trilha.frequencia} onValueChange={(v) => onMudar((t) => trocarFrequencia(t, v))} disabled={calendarioTravado} className={SEG}>
            <RadioGroupOption value="anual" className={PILULA}>Uma vez por ano</RadioGroupOption>
            <RadioGroupOption value="semestral" className={PILULA}>Duas vezes por ano</RadioGroupOption>
          </RadioGroup>
        </Regra>
        <Regra rotulo={rotuloDoMes}>
          <Select value={String(primeiro)} onValueChange={(v) => onMudar((t) => com(t, { mes: Number(v) }))} disabled={calendarioTravado}>
            <SelectTrigger aria-label={rotuloDoMes} className="h-10 w-[240px] rounded-[11px] border-border focus-visible:anel-foco">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(semestral ? MESES.slice(0, 6) : MESES).map((nome, i) => (
                <SelectItem key={nome} value={String(i + 1)}>
                  {semestral ? `${maiuscula(nome)} e ${MESES[i + 6]}` : maiuscula(nome)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[12.5px] text-muted-foreground">{periodoTexto(trilha)}</p>
        </Regra>
        {semestral && (
          <Regra rotulo="A renovação olha" ajuda="Seis meses têm poucos vencimentos.">
            <RadioGroup aria-label="A renovação olha" value={trilha.janelaRenovacao} onValueChange={(v) => onMudar((t) => com(t, { janelaRenovacao: v }))} className={SEG}>
              <RadioGroupOption value="periodo" className={PILULA}>Só o semestre</RadioGroupOption>
              <RadioGroupOption value="12meses" className={PILULA}>12 meses até o fim do semestre</RadioGroupOption>
            </RadioGroup>
          </Regra>
        )}
      </Bloco>

      <Bloco icone={SlidersHorizontal} titulo="Como cada número conta">
        {ligados.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">Nenhum número conta nesta trilha. Ligue um na aba Níveis e metas.</p>
        )}
        {ligados.map((id) => {
          const Icone = NUMERO_UI[id].icone;
          return (
            <div key={id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 border-t border-border px-5 py-4 first-of-type:border-t-0">
              <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-[11px]', ui.tile)}>
                <Icone size={18} />
              </span>
              <div>
                <b className="text-[14px] font-semibold">{NUMEROS[id].nome}</b>
                <p className="mt-0.5 max-w-[72ch] text-[13px] leading-normal text-foreground/80">{NUMERO_UI[id].regra}</p>
                <Ajuste id={id} trilha={trilha} onMudar={onMudar} />
              </div>
            </div>
          );
        })}
      </Bloco>
    </div>
  );
}
```

- [ ] **Step 5: Write the editor**

Crie `src/views/settings/carreira/TrilhaEditor.jsx`:

```jsx
import { useId, useState } from 'react';
import { Calendar, ChevronLeft, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { TRILHA_PROFESSOR } from '../../../lib/carreira/trilhas.js';
import { problemaDaTrilha } from '../../../lib/carreira/validacao.js';
import { com, metasEmBranco, MOTIVO_DO_ARQUIVAR, mudou, totalDePessoas } from '../../../lib/carreira/rascunho.js';
import { TAB_TRIGGER } from '../../professores/ProfessoresComum.jsx';
import {
  BASE_UI, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, maiuscula, paraQuemTexto, pessoasTexto, quandoTexto,
} from './carreiraTexto.js';
import { TrilhaGrade } from './TrilhaGrade.jsx';
import { TrilhaRegras } from './TrilhaRegras.jsx';

// A trilha aberta (mockup A refinado): o cabeçalho com o nome editável, as
// etiquetas e o Arquivar, as duas abas e a barra de salvar presa embaixo. O
// rascunho é da trilha, e não da aba: trocar de aba (o `aba` vem do endereço)
// não perde o que foi digitado. `gravada` é a trilha como está no banco (null
// na trilha nova), e `pessoas` conta quem está em cada nível dela. Quem grava é
// o `onSalvar`, que devolve a promessa do salvarTrilha.
function Fato({ icone: Icone, children }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 text-[12.5px] font-semibold text-foreground/80">
      <Icone size={14} aria-hidden="true" className="text-muted-foreground" />
      {children}
    </span>
  );
}

export function TrilhaEditor({ inicial, gravada, outras, pessoas, aba, onAba, voltarHref, modalities, onSalvar, onArquivar, onDescartarNova }) {
  const toast = useToast();
  const motivoId = useId();
  const [rascunho, setRascunho] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const nova = !gravada;
  const total = totalDePessoas(pessoas);
  const problema = problemaDaTrilha(rascunho, { gravada, outras, pessoasPorNivel: pessoas });
  const temMudanca = mudou(rascunho, gravada);
  const brancas = metasEmBranco(rascunho);
  const ui = BASE_UI[rascunho.base];
  const Icone = ui.icone;
  const arquivarTravado = total > 0;

  let status = 'Nenhuma mudança ainda.';
  if (problema) status = problema.texto;
  else if (brancas > 0) status = `${brancas} ${brancas === 1 ? 'meta em branco' : 'metas em branco'}. A trilha salva assim.`;
  else if (temMudanca) status = 'Tudo certo para salvar.';

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar(rascunho);
      toast.success('Trilha salva.');
    } catch (err) {
      console.error('salvar trilha', err);
      toast.error(err?.paraTela ? err.message : 'Não deu para salvar a trilha. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tabs value={aba} onValueChange={onAba} className="gap-[18px]">
      <header className="rounded-[18px] border border-border bg-card px-[22px] pt-[18px] shadow-card">
        <AppLink to={voltarHref} className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
          <ChevronLeft size={15} aria-hidden="true" />
          Plano de carreira
        </AppLink>
        <div className="mt-2.5 flex flex-wrap items-start gap-4">
          <span aria-hidden="true" className={cn('grid size-[46px] flex-none place-items-center rounded-[14px] text-white', ui.fundo)}>
            <Icone size={22} />
          </span>
          <div className="min-w-[240px] flex-1">
            <input
              value={rascunho.nome}
              onChange={(e) => setRascunho((t) => com(t, { nome: e.target.value }))}
              placeholder="Nome da trilha"
              aria-label="Nome da trilha"
              autoFocus={nova}
              className="-mx-1.5 mt-1 w-full rounded-lg bg-transparent px-1.5 font-display text-[26px] font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/60 hover:bg-muted/50 focus-visible:anel-foco"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Fato icone={User}>{paraQuemTexto(rascunho)}</Fato>
              <Fato icone={Users}>{`${maiuscula(pessoasTexto(total))} nesta trilha`}</Fato>
              <Fato icone={Calendar}>{quandoTexto(rascunho)}</Fato>
            </div>
          </div>
          {!nova && (
            <>
              <button
                type="button"
                aria-disabled={arquivarTravado ? 'true' : undefined}
                aria-describedby={arquivarTravado ? motivoId : undefined}
                title={arquivarTravado ? MOTIVO_DO_ARQUIVAR : undefined}
                onClick={() => (arquivarTravado ? toast.warning(MOTIVO_DO_ARQUIVAR) : onArquivar())}
                className="inline-flex h-[34px] items-center rounded-[10px] border border-transparent px-3 text-[13px] font-semibold text-muted-foreground outline-none hover:border-rose-200 hover:text-rose-700 focus-visible:anel-foco aria-disabled:cursor-not-allowed aria-disabled:hover:border-transparent aria-disabled:hover:text-muted-foreground dark:hover:text-rose-300"
              >
                Arquivar trilha
              </button>
              {arquivarTravado && <span id={motivoId} className="sr-only">{MOTIVO_DO_ARQUIVAR}</span>}
            </>
          )}
        </div>
        <TabsList
          variant="line"
          aria-label="Partes da trilha"
          className="-mx-[22px] mt-4 w-[calc(100%+44px)] justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-t border-border p-0 px-[18px] group-data-[orientation=horizontal]/tabs:h-11"
        >
          <TabsTrigger value="metas" className={TAB_TRIGGER}>Níveis e metas</TabsTrigger>
          <TabsTrigger value="regras" className={TAB_TRIGGER}>Regras da trilha</TabsTrigger>
        </TabsList>
      </header>

      <TabsContent value="metas" tabIndex={-1}>
        <TrilhaGrade trilha={rascunho} pessoas={pessoas} onMudar={setRascunho} onRegras={() => onAba('regras')} avisar={(m) => toast.warning(m)} />
      </TabsContent>
      <TabsContent value="regras" tabIndex={-1}>
        <TrilhaRegras
          trilha={rascunho}
          onMudar={setRascunho}
          totalDePessoas={total}
          modalities={modalities}
          calendarioTravado={rascunho.id === TRILHA_PROFESSOR}
        />
      </TabsContent>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card/95 py-2.5 pl-[18px] pr-3 shadow-card backdrop-blur">
        <span role="status" className={cn('mr-auto text-[13px]', problema ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
          {status}
        </span>
        <button
          type="button"
          onClick={() => (nova ? onDescartarNova() : setRascunho(gravada))}
          disabled={salvando || (!nova && !temMudanca)}
          className={BOTAO_SECUNDARIO}
        >
          Descartar
        </button>
        <button type="button" onClick={salvar} disabled={salvando || Boolean(problema) || !temMudanca} className={BOTAO_PRIMARIO}>
          {salvando ? 'Salvando…' : 'Salvar trilha'}
        </button>
      </div>
    </Tabs>
  );
}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/lib/__tests__/carreiraEditor.behavior.test.js`
Expected: PASS.

- [ ] **Step 7: Run the sweeps that read the new files**

Run: `npx eslint src/views/settings/carreira/ && npx vitest run src/lib/__tests__/anelDeFoco.test.js src/lib/__tests__/fundoDaPagina.test.js src/lib/__tests__/overscrollGuard.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/acessoSweep.test.js src/lib/__tests__/movimentoReduzido.test.js`
Expected: lint sem erro e PASS. A grade e a lista de abas rolam de lado com `overscroll-x-contain`; a barra de salvar é `sticky bottom-3`, sem top negativo; o único botão de fundo azul sólido (`BOTAO_PRIMARIO`) e os chips escolhidos levam a folga do anel.

- [ ] **Step 8: Commit**

```bash
git add src/views/settings/carreira/TrilhaGrade.jsx src/views/settings/carreira/TrilhaRegras.jsx src/views/settings/carreira/TrilhaEditor.jsx src/lib/__tests__/carreiraEditor.behavior.test.js
git commit -m "feat: editor da trilha de carreira, com a grade e as regras"
```

---

### Task 8: a seção Plano de carreira (lista e trilha aberta)

**Files:**
- Create: `src/views/settings/carreira/CarreiraSettingsSection.jsx`
- Create: `src/lib/__tests__/carreiraSettings.behavior.test.js`

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/carreiraSettings.behavior.test.js`:

```js
// @vitest-environment jsdom
// Configurações → Plano de carreira (plano 2026-11-26-plano-de-carreira-02,
// tarefa 8): a lista das trilhas, a trilha aberta pelo endereço, a trilha nova,
// arquivar e desarquivar, e o que vai para o salvarTrilha.
import { act, createElement as h, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O Popper do Radix mede o conteúdo com ResizeObserver, que o jsdom não tem.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const s = vi.hoisted(() => ({ trilhas: null, salvar: null }));
vi.mock('../firebase.js', () => ({ appId: 'acad', db: {}, auth: {} }));
vi.mock('../../hooks/useCarreira.js', () => ({
  useCarreira: () => ({ carreira: { doc: null, erro: null }, trilhas: s.trilhas }),
}));
vi.mock('../carreiraWrites.js', () => ({ salvarTrilha: (...args) => s.salvar(...args) }));

const { hrefFor, parseAppPath } = await import('../routes.js');
const { trilhasDe } = await import('../carreira/trilhas.js');
const { ToastContext } = await import('../../contexts/ToastContext.jsx');
const { GeneralConfigContext } = await import('../../contexts/GeneralConfigContext.jsx');
const { CarreiraSettingsSection } = await import('../../views/settings/carreira/CarreiraSettingsSection.jsx');

const toast = { show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
const PROFESSORES = [
  { id: 'p1', nome: 'Ana', nivel: 'junior' },
  { id: 'p2', nome: 'Bruno', nivel: 'junior' },
  { id: 'p3', nome: 'Carla', nivel: 'pleno' },
  { id: 'p4', nome: 'Davi', ativo: false, nivel: 'senior' },
  { id: 'p5', nome: 'Eva', trilhaId: 'estagiario', nivel: 'estagiario1' },
];
const USUARIOS = [{ id: 'g1', name: 'Gestor', role: 'admin' }, { id: 'c1', name: 'Caio', role: 'consultant' }];
const APP_USER = { id: 'g1', role: 'admin' };
const ARQUIVADA = { nome: 'Pilates teste', base: 'professor', niveis: [{ id: 'n1', nome: 'Único', mesesMinimos: null }], arquivada: true, ordem: 5 };

const nav = { location: null, type: null };
function Tela() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    nav.location = location;
    nav.type = type;
  });
  const r = parseAppPath(location.pathname);
  // O mesmo que o goToSub do App faz com a tela já aberta.
  const onAba = (id, aba) => navigate(hrefFor('acad', 'settings', { sub: 'carreira', trilhaId: id, trilhaAba: aba }), { replace: true, state: location.state });
  return h(CarreiraSettingsSection, {
    db: {}, appUser: APP_USER, usersList: USUARIOS, listenersActive: true, tenantSlug: 'acad',
    trilhaId: r.trilhaId ?? null, trilhaAba: r.trilhaAba ?? null, onAba,
  });
}

let container;
let root;
beforeEach(() => {
  vi.clearAllMocks();
  s.trilhas = trilhasDe({ trilhas: { 'trilha-arq': ARQUIVADA } });
  s.salvar = vi.fn(async () => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async (entry) => {
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [entry] },
      h(ToastContext.Provider, { value: toast },
        h(GeneralConfigContext.Provider, { value: { professores: PROFESSORES, modalities: [{ id: 'func', name: 'Funcional' }] } },
          h(Tela)))));
  });
};
const cartoes = () => [...document.body.querySelectorAll('ul a')];
const campo = (rotulo) => document.body.querySelector(`input[aria-label="${rotulo}"]`);
const botao = (rotulo) => [...document.body.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === rotulo || b.textContent.trim() === rotulo);
const aba = (texto) => [...document.body.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === texto);
const clicar = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.click(); });
};
const mousedown = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })); });
};
const digitar = async (el, v) => {
  expect(el).toBeTruthy();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('a lista das trilhas', () => {
  it('um cartão por trilha, com o link, para quem e as pessoas, e as arquivadas recolhidas', async () => {
    await render('/acad/configuracoes/carreira');
    expect(cartoes().map((a) => a.getAttribute('href'))).toEqual([
      '/acad/configuracoes/carreira/professor',
      '/acad/configuracoes/carreira/estagiario',
      '/acad/configuracoes/carreira/consultor',
    ]);
    const [professor, estagiario, consultor] = cartoes();
    expect(professor.textContent).toContain('Para professores formados, 3 pessoas');
    expect(professor.textContent).toContain('Avaliação em dezembro');
    expect(professor.textContent).toContain('4 números contam');
    expect(estagiario.textContent).toContain('Para estagiários, 1 pessoa');
    expect(estagiario.textContent).toContain('Avaliação em junho e dezembro');
    expect(consultor.textContent).toContain('Para consultores, ninguém');
    expect(document.body.querySelector('summary').textContent).toBe('Arquivadas (1)');
    expect(document.body.textContent).toContain('Pilates teste');
  });

  it('o id que não existe e a trilha arquivada caem na lista', async () => {
    await render('/acad/configuracoes/carreira/xyz');
    expect(cartoes()).toHaveLength(3);
    act(() => root.unmount());
    root = createRoot(container);
    await render('/acad/configuracoes/carreira/trilha-arq');
    expect(cartoes()).toHaveLength(3);
    expect(campo('Nome da trilha')).toBeNull();
  });

  it('Desarquivar grava a trilha sem o arquivada', async () => {
    await render('/acad/configuracoes/carreira');
    await clicar(botao('Desarquivar'));
    const [, args] = s.salvar.mock.calls[0];
    expect(args.trilha).toMatchObject({ id: 'trilha-arq', arquivada: false });
    expect(args.gravada).toMatchObject({ id: 'trilha-arq', arquivada: true });
    expect(toast.success).toHaveBeenCalledWith('Trilha desarquivada.');
  });
});

describe('a trilha aberta', () => {
  it('o endereço abre a trilha, com as pessoas dela', async () => {
    await render('/acad/configuracoes/carreira/professor');
    expect(campo('Nome da trilha').value).toBe('Professor');
    expect(document.body.textContent).toContain('3 pessoas nesta trilha');
    expect(document.body.textContent).toContain('Para professores formados');
  });

  it('trocar de aba troca o endereço com replace', async () => {
    await render('/acad/configuracoes/carreira/professor');
    await mousedown(aba('Regras da trilha'));
    expect(nav.location.pathname).toBe('/acad/configuracoes/carreira/professor/regras');
    expect(nav.type).toBe('REPLACE');
    expect(document.body.textContent).toContain('Como cada número conta');
  });

  it('Salvar passa a gravada, as outras trilhas, as pessoas e quem salvou', async () => {
    await render('/acad/configuracoes/carreira/professor');
    await digitar(campo('Renovação da carteira, Júnior'), '50');
    await clicar(botao('Salvar trilha'));
    const [db, args] = s.salvar.mock.calls[0];
    expect(db).toEqual({});
    expect(args.trilha.numeros.renovacao.metas.junior).toBe(50);
    expect(args.gravada).toMatchObject({ id: 'professor', padrao: true });
    expect(args.outras.map((t) => t.id)).toEqual(['estagiario', 'consultor', 'trilha-arq']);
    expect(args.pessoasPorNivel).toEqual({ junior: 2, pleno: 1, senior: 0, _semNivel: 0 });
    expect(args.appUser).toBe(APP_USER);
  });

  it('Arquivar sem gente grava arquivada e volta à lista com replace', async () => {
    await render('/acad/configuracoes/carreira/consultor');
    await clicar(botao('Arquivar trilha'));
    const [, args] = s.salvar.mock.calls[0];
    expect(args.trilha).toMatchObject({ id: 'consultor', arquivada: true });
    expect(args.gravada).toMatchObject({ id: 'consultor', arquivada: false });
    expect(toast.success).toHaveBeenCalledWith('Trilha arquivada.');
    expect(nav.location.pathname).toBe('/acad/configuracoes/carreira');
    expect(nav.type).toBe('REPLACE');
  });
});

describe('a trilha nova', () => {
  it('abre em branco no endereço dela e salva sem gravada', async () => {
    await render('/acad/configuracoes/carreira');
    await clicar(botao('Nova trilha'));
    await clicar(botao('Para consultores'));
    expect(nav.location.pathname).toMatch(/^\/acad\/configuracoes\/carreira\/trilha-[0-9a-z]{6}$/);
    expect(nav.type).toBe('PUSH');
    expect(campo('Nome da trilha').value).toBe('');
    expect(document.body.textContent).toContain('Para consultores');
    expect(document.body.querySelector('[role="status"]').textContent).toBe('Dê um nome à trilha.');
    await digitar(campo('Nome da trilha'), 'Consultor sênior');
    await clicar(botao('Salvar trilha'));
    const [, args] = s.salvar.mock.calls[0];
    expect(args.gravada).toBeNull();
    expect(args.trilha).toMatchObject({ nome: 'Consultor sênior', base: 'consultor', ordem: 6 });
    expect(nav.location.pathname.endsWith(args.trilha.id)).toBe(true);
  });

  it('Descartar volta à lista com replace', async () => {
    await render('/acad/configuracoes/carreira');
    await clicar(botao('Nova trilha'));
    await clicar(botao('Para professores'));
    await clicar(botao('Descartar'));
    expect(nav.location.pathname).toBe('/acad/configuracoes/carreira');
    expect(nav.type).toBe('REPLACE');
    expect(cartoes()).toHaveLength(3);
  });
});
```

A ordem da trilha nova é 6: a arquivada tem ordem 5, e as padrão, 0 a 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/carreiraSettings.behavior.test.js`
Expected: FAIL, "Failed to resolve import ../../views/settings/carreira/CarreiraSettingsSection.jsx".

- [ ] **Step 3: Write the section**

Crie `src/views/settings/carreira/CarreiraSettingsSection.jsx`:

```jsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SettingsSectionHeader } from '../../../components/ui/SettingsCard.jsx';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../../contexts/GeneralConfigContext.jsx';
import { useCarreira } from '../../../hooks/useCarreira.js';
import { salvarTrilha } from '../../../lib/carreiraWrites.js';
import { numerosDaBase } from '../../../lib/carreira/numeros.js';
import { novaTrilha, pessoasPorNivel, totalDePessoas } from '../../../lib/carreira/rascunho.js';
import { hrefFor } from '../../../lib/routes.js';
import {
  BASE_UI, BOTAO_PRIMARIO, maiuscula, numerosContamTexto, paraQuemTexto, pessoasTexto, quandoTexto,
} from './carreiraTexto.js';
import { TrilhaEditor } from './TrilhaEditor.jsx';

// Configurações → Plano de carreira (spec 2026-11-26-plano-de-carreira-
// configuravel, mockup A). Sem trilha no endereço, a lista das trilhas; com
// ela, o editor. O id que não existe (ou de trilha arquivada) cai na lista. A
// trilha nova vive no estado da seção até salvar: o F5 antes disso a perde.
// Abrir a trilha empilha no histórico (link), trocar de aba troca a entrada
// (`onAba`, o goToSub do App), e arquivar ou descartar a nova voltam à lista
// com replace.
function NovaTrilha({ onCriar }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={BOTAO_PRIMARIO}>
          <Plus size={16} aria-hidden="true" />
          Nova trilha
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-muted-foreground">Para quem é a trilha?</p>
        {[['professor', 'Para professores'], ['consultor', 'Para consultores']].map(([base, rotulo]) => (
          <button
            key={base}
            type="button"
            onClick={() => onCriar(base)}
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold outline-none hover:bg-muted focus-visible:anel-foco"
          >
            {rotulo}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CartaoDaTrilha({ trilha, pessoas, href }) {
  const ui = BASE_UI[trilha.base];
  const Icone = ui.icone;
  const N = trilha.niveis.length;
  const degrau = (i) => (N === 1 ? 2 : (i * 2) / (N - 1));
  const contam = numerosDaBase(trilha.base).filter((id) => trilha.numeros[id]?.ligado).length;
  return (
    <AppLink
      to={href}
      className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-x-[18px] gap-y-3 rounded-[18px] border border-border bg-card px-[18px] py-4 shadow-card outline-none hover:border-brand-200 focus-visible:anel-foco md:grid-cols-[46px_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_20px]"
    >
      <span aria-hidden="true" className={cn('grid size-[46px] place-items-center rounded-[14px] text-white', ui.fundo)}>
        <Icone size={20} />
      </span>
      <span className="min-w-0">
        <b className="block truncate font-display text-[17px] font-bold tracking-tight">{trilha.nome}</b>
        <small className="mt-0.5 block text-[12.5px] text-muted-foreground">{paraQuemTexto(trilha)}, {pessoasTexto(pessoas)}</small>
      </span>
      <span className="col-start-2 min-w-0 md:col-start-auto">
        <span className="sr-only">{`Níveis: ${trilha.niveis.map((n) => n.nome).join(', ')}.`}</span>
        <span aria-hidden="true" className="flex h-[34px] items-end gap-1">
          {trilha.niveis.map((n, i) => (
            <span key={n.id} className={cn('block w-16 rounded-[7px_7px_3px_3px]', ui.degrau)} style={{ height: 10 + degrau(i) * 10, opacity: 0.35 + degrau(i) * 0.3 }} />
          ))}
        </span>
        <span aria-hidden="true" className="mt-1 flex gap-1">
          {trilha.niveis.map((n) => <span key={n.id} className="w-16 truncate text-[11.5px] font-semibold text-foreground/80">{n.nome}</span>)}
        </span>
      </span>
      <span className="col-start-2 text-[13px] text-foreground/80 md:col-start-auto">
        {quandoTexto(trilha)}
        <small className="block text-[12.5px] text-muted-foreground">{numerosContamTexto(contam)}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="hidden text-muted-foreground/70 md:block" />
    </AppLink>
  );
}

export function CarreiraSettingsSection({ db, appUser, usersList, listenersActive, tenantSlug, trilhaId, trilhaAba, onAba }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { professores, modalities } = useGeneralConfig();
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const [nova, setNova] = useState(null);

  const listaHref = hrefFor(tenantSlug, 'settings', { sub: 'carreira' });
  const trilhaHref = (id) => hrefFor(tenantSlug, 'settings', { sub: 'carreira', trilhaId: id });
  const pessoasDe = (t) => pessoasPorNivel(t, { professores, usuarios: usersList });
  const voltarALista = () => navigate(listaHref, { replace: true, state: location.state });

  if (!trilhas) return <p className="text-[13px] text-muted-foreground">Carregando as trilhas…</p>;
  const aviso = carreira?.erro && (
    <p role="alert" className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para ler as trilhas gravadas. Recarregue a página.</p>
  );

  const outrasDe = (id) => trilhas.filter((t) => t.id !== id);
  const gravada = trilhaId ? (trilhas.find((t) => t.id === trilhaId && !t.arquivada) ?? null) : null;
  const aberta = gravada ?? (trilhaId && nova?.id === trilhaId ? nova : null);

  const falhou = (err, texto) => {
    console.error(texto, err);
    toast.error(err?.paraTela ? err.message : texto);
  };

  if (aberta) {
    const pessoas = pessoasDe(gravada ?? aberta);
    const salvar = (rascunho) => salvarTrilha(db, {
      trilha: rascunho, gravada, outras: outrasDe(rascunho.id), pessoasPorNivel: pessoas, appUser,
    });
    const arquivar = async () => {
      try {
        await salvarTrilha(db, { trilha: { ...gravada, arquivada: true }, gravada, outras: outrasDe(gravada.id), pessoasPorNivel: pessoas, appUser });
        toast.success('Trilha arquivada.');
        voltarALista();
      } catch (err) {
        falhou(err, 'Não deu para arquivar a trilha. Tente de novo.');
      }
    };
    return (
      <div className="flex flex-col gap-4">
        {aviso}
        <TrilhaEditor
          key={aberta.id}
          inicial={aberta}
          gravada={gravada}
          outras={outrasDe(aberta.id)}
          pessoas={pessoas}
          aba={trilhaAba === 'regras' ? 'regras' : 'metas'}
          onAba={(a) => onAba(aberta.id, a)}
          voltarHref={listaHref}
          modalities={modalities}
          onSalvar={salvar}
          onArquivar={arquivar}
          onDescartarNova={() => {
            setNova(null);
            voltarALista();
          }}
        />
      </div>
    );
  }

  const criar = (base) => {
    const t = novaTrilha(base, trilhas);
    setNova(t);
    navigate(trilhaHref(t.id));
  };
  const desarquivar = async (t) => {
    try {
      await salvarTrilha(db, { trilha: { ...t, arquivada: false }, gravada: t, outras: outrasDe(t.id), pessoasPorNivel: pessoasDe(t), appUser });
      toast.success('Trilha desarquivada.');
    } catch (err) {
      falhou(err, 'Não deu para desarquivar a trilha. Tente de novo.');
    }
  };
  const ativas = trilhas.filter((t) => !t.arquivada);
  const arquivadas = trilhas.filter((t) => t.arquivada);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Plano de carreira"
        hint="As trilhas que a equipe segue. Cada uma tem os níveis, os números que contam e a meta de cada nível."
      >
        <NovaTrilha onCriar={criar} />
      </SettingsSectionHeader>
      {aviso}
      <ul className="grid gap-3">
        {ativas.map((t) => (
          <li key={t.id}>
            <CartaoDaTrilha trilha={t} pessoas={totalDePessoas(pessoasDe(t))} href={trilhaHref(t.id)} />
          </li>
        ))}
      </ul>
      {arquivadas.length > 0 && (
        <details className="group">
          <summary className="flex w-max cursor-pointer list-none items-center gap-1.5 rounded-md px-0.5 py-1.5 text-[13px] font-semibold text-muted-foreground outline-none focus-visible:anel-foco [&::-webkit-details-marker]:hidden">
            <ChevronRight size={15} aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            {`Arquivadas (${arquivadas.length})`}
          </summary>
          <ul className="mt-1.5 grid gap-1.5">
            {arquivadas.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
                <b className="font-semibold text-foreground/80">{t.nome}</b>
                <span>{`${maiuscula(pessoasTexto(totalDePessoas(pessoasDe(t))))} nesta trilha`}</span>
                <button
                  type="button"
                  onClick={() => desarquivar(t)}
                  className="ml-auto rounded font-semibold text-brand-700 underline-offset-2 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300"
                >
                  Desarquivar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```

O texto do `summary` sai numa string só (`` `Arquivadas (${n})` ``), para o teste ler "Arquivadas (1)" sem espaço sobrando entre os nós.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/__tests__/carreiraSettings.behavior.test.js`
Expected: PASS.

- [ ] **Step 5: Run lint and the sweeps**

Run: `npx eslint src/views/settings/carreira/ && npx vitest run src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/focusRing.test.js src/lib/__tests__/anelDeFoco.test.js`
Expected: lint sem erro e PASS. Os dois `navigate` da seção são push sem state ou replace com `location.state`, que a varredura aceita, e a `key` do editor é `aberta.id`, fora da lista de nomes proibidos.

- [ ] **Step 6: Commit**

```bash
git add src/views/settings/carreira/CarreiraSettingsSection.jsx src/lib/__tests__/carreiraSettings.behavior.test.js
git commit -m "feat: lista das trilhas de carreira e a trilha nova"
```

---

### Task 9: a seção nas Configurações

**Files:**
- Modify: `src/views/settings/SettingsView.jsx`
- Modify: `src/App.jsx:229` e `src/App.jsx:1968`

Ligação sem regra nova: a seção já tem testes próprios. A conferência é o lint, o build e a varredura de filtros, que lê o `App.jsx`.

- [ ] **Step 1: Mount the section in SettingsView**

Em `src/views/settings/SettingsView.jsx`:

Troque:

```js
import { ZapIntegrationSection } from './ZapIntegrationSection.jsx';
```

por:

```js
import { ZapIntegrationSection } from './ZapIntegrationSection.jsx';
import { CarreiraSettingsSection } from './carreira/CarreiraSettingsSection.jsx';
```

Troque:

```js
// CONFIGURAÇÕES — doze seções em sete blocos
//
// Redesign 2026-10 (mockup A, trilho em grupos): Visão geral, Academia (perfil e
// plano), Equipe, Dia a dia, Funil, Conexões e Manutenção da base. O trilho é
```

por:

```js
// CONFIGURAÇÕES — treze seções em sete blocos
//
// Redesign 2026-10 (mockup A, trilho em grupos): Visão geral, Academia (perfil e
// plano), Equipe (com o Plano de carreira, só com o módulo faltosos), Dia a dia,
// Funil, Conexões e Manutenção da base. O trilho é
```

Troque:

```js
function SettingsView({
  section, onSection, db, statuses, sources, usersList, appUser, tags, lossReasons,
  dores, funnels, modalities, planos, trialClassOptions, units, metaWeekdays
}) {
```

por:

```js
function SettingsView({
  section, onSection, db, statuses, sources, usersList, appUser, tags, lossReasons,
  dores, funnels, modalities, planos, trialClassOptions, units, metaWeekdays,
  trilhaId, trilhaAba, onCarreiraAba, listenersActive
}) {
```

Troque:

```js
  const secao = settingsSection(section, canImport);
  const groups = settingsRailGroups(canImport);
```

por:

```js
  const secao = settingsSection(section, canImport, appUser?.tenantModules);
  const groups = settingsRailGroups(canImport, appUser?.tenantModules);
```

Troque:

```jsx
        {secao === 'transfer' && (
```

por:

```jsx
        {secao === 'carreira' && (
          <CarreiraSettingsSection
            db={db} appUser={appUser} usersList={usersList} listenersActive={listenersActive}
            tenantSlug={tenantSlug} trilhaId={trilhaId} trilhaAba={trilhaAba} onAba={onCarreiraAba}
          />
        )}
        {secao === 'transfer' && (
```

- [ ] **Step 2: Pass the trilha from App.jsx**

Em `src/App.jsx`, troque:

```js
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab, sub, modelId, profId } = screenState(shown, location.state, appUser);
```

por:

```js
  const { fichaOpen, profileLeadId, activeTab, resolvedTab, superTab, sub, modelId, profId, trilhaId, trilhaAba } = screenState(shown, location.state, appUser);
```

E troque:

```jsx
              {activeTab === 'settings' && isGestor(appUser) && <SettingsView section={sub} onSection={(id) => goToSub('settings', id)} sources={sources}
```

por:

```jsx
              {activeTab === 'settings' && isGestor(appUser) && <SettingsView section={sub} onSection={(id) => goToSub('settings', id)} trilhaId={trilhaId} trilhaAba={trilhaAba} onCarreiraAba={(id, aba) => goToSub('settings', 'carreira', { trilhaId: id, trilhaAba: aba })} listenersActive={listenersActive} sources={sources}
```

O `goToSub` troca a entrada com replace, porque a tela mostrada já é `settings`.

- [ ] **Step 3: Run lint, the sweeps that read App.jsx and the build**

Run: `npx eslint src/App.jsx src/views/settings/SettingsView.jsx && npx vitest run src/lib/__tests__/filtrosNoEndereco.sweep.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/protecaoDeErro.sweep.test.js && npm run build`
Expected: lint sem erro, testes PASS e build sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/SettingsView.jsx src/App.jsx
git commit -m "feat: Plano de carreira montado nas Configurações"
```

---

### Task 10: sai a sub-tela /professores/metas

**Files:**
- Modify: `src/lib/routes.js`
- Modify: `src/views/professores/ProfessoresView.jsx`
- Modify: `src/hooks/useProfessoresDados.js`
- Delete: `src/views/professores/MetasForm.jsx`
- Modify: `src/lib/__tests__/routes.professores.test.js`
- Modify: `src/lib/__tests__/professoresView.behavior.test.js`
- Modify: `src/lib/__tests__/professorPerfil.behavior.test.js:95`

- [ ] **Step 1: Write the failing tests**

Em `src/lib/__tests__/routes.professores.test.js`:

Troque o primeiro teste:

```js
  it('lista e metas', () => {
    expect(parseAppPath(`/${T}/professores`)).toMatchObject({ screen: 'professores', sub: null, subUnknown: false, unknown: false });
    expect(parseAppPath(`/${T}/professores/metas`)).toMatchObject({ screen: 'professores', sub: 'metas' });
    expect(parseAppPath(`/${T}/professores/xyz`)).toMatchObject({ screen: 'professores', subUnknown: true });
    expect(hrefFor(T, 'professores', { sub: 'metas' })).toBe(`/${T}/professores/metas`);
```

por:

```js
  it('lista e pesquisas; o endereço das metas é o antigo', () => {
    expect(parseAppPath(`/${T}/professores`)).toMatchObject({ screen: 'professores', sub: null, subUnknown: false, unknown: false });
    expect(parseAppPath(`/${T}/professores/metas`)).toMatchObject({ screen: 'professores', metasAntigas: true, subUnknown: false });
    expect('metasAntigas' in parseAppPath(`/${T}/professores`)).toBe(false);
    expect(parseAppPath(`/${T}/professores/xyz`)).toMatchObject({ screen: 'professores', subUnknown: true });
    expect(hrefFor(T, 'professores', { sub: 'metas' })).toBe(`/${T}/professores`);
```

No describe `'decisão de rota'`, acrescente no fim:

```js
  // As metas moram em Configurações → Plano de carreira (plano
  // 2026-11-26-plano-de-carreira-02, tarefa 10).
  it('/professores/metas leva à trilha Professor nas Configurações', () => {
    expect(decide(`/${T}/professores/metas`, gestor)).toMatchObject({
      kind: 'redirect',
      to: `/${T}/configuracoes/carreira/professor`,
      target: { screen: 'settings', sub: 'carreira', trilhaId: 'professor', trilhaAba: 'metas' },
      notice: null,
    });
    expect(decide('/outra-academia/professores/metas', gestor)).toMatchObject({ kind: 'redirect', to: `/${T}/configuracoes/carreira/professor` });
    expect(decide(`/${T}/professores/metas`, gestorSemModulo)).toMatchObject({ kind: 'redirect', to: `/${T}`, notice: 'nao-encontrada' });
    expect(decide(`/${T}/professores/metas`, consultor)).toMatchObject({ kind: 'redirect', notice: 'so-gestor' });
  });
```

Em `src/lib/__tests__/professoresView.behavior.test.js`:

Troque o cabeçalho:

```js
// A tela Professores do gestor (plano 2026-11-25, Tarefa 10): a lista mostra
// só os ativos, cada linha leva ao perfil, o ciclo mora no endereço, e as
// metas recusam a faixa invertida e gravam o documento inteiro.
```

por:

```js
// A tela Professores do gestor (plano 2026-11-25, Tarefa 10): a lista mostra
// só os ativos, cada linha leva ao perfil e o ciclo mora no endereço. As metas
// saíram para Configurações → Plano de carreira (plano 2026-11-26, PR 2).
```

Troque:

```js
  const tab = location.pathname.endsWith('/professores/metas') ? 'metas' : 'lista';
```

por:

```js
  const tab = location.pathname.endsWith('/professores/pesquisas') ? 'pesquisas' : 'lista';
```

Troque:

```js
    metas: METAS_PADRAO,
    salvarMetas: vi.fn(async () => {}),
  };
```

por:

```js
    metas: METAS_PADRAO,
  };
```

Apague o helper `setValue` (só as metas o usavam):

```js
const setValue = async (el, v) => {
  expect(el).toBeTruthy();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
```

E troque o `describe('as metas', ...)` inteiro (os três testes, da linha `describe('as metas', () => {` até o `});` que o fecha, antes de `describe('o texto de cada critério'`) por:

```js
describe('as metas', () => {
  it('saíram da tela: a aba não existe e o link leva à trilha Professor nas Configurações', async () => {
    await render('/acad/professores');
    expect([...document.body.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Professores2', 'Pesquisas']);
    const link = [...document.body.querySelectorAll('a')].find((a) => a.textContent === 'Metas da trilha');
    expect(link.getAttribute('href')).toBe('/acad/configuracoes/carreira/professor');
  });
});
```

Em `src/lib/__tests__/professorPerfil.behavior.test.js`, apague a linha:

```js
    salvarMetas: vi.fn(),
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/routes.professores.test.js src/lib/__tests__/professoresView.behavior.test.js`
Expected: FAIL. `/professores/metas` ainda dá `sub: 'metas'`, e a tela ainda tem a aba Metas e não tem o link.

- [ ] **Step 3: Redirect the old address in routes.js**

Em `src/lib/routes.js`:

Troque:

```js
// Sub-telas de Professores (spec 2026-11-24-perfil-do-professor, PR 3): a
// lista e as metas. A lista é o endereço curto /<academia>/professores. O PR 4
// acrescenta as pesquisas.
export const PROFESSORES_SUBS = Object.freeze({
  lista: 'lista',
  pesquisas: 'pesquisas',
  metas: 'metas',
});
```

por:

```js
// Sub-telas de Professores (spec 2026-11-24-perfil-do-professor, PR 3): a
// lista e as pesquisas. A lista é o endereço curto /<academia>/professores. As
// metas saíram para Configurações → Plano de carreira (plano
// 2026-11-26-plano-de-carreira-02): /professores/metas é lido à parte
// (metasAntigas) e leva à trilha Professor.
export const PROFESSORES_SUBS = Object.freeze({
  lista: 'lista',
  pesquisas: 'pesquisas',
});
```

No `readScreen`, troque:

```js
    out.screen = 'professores';
    out.rest = segs.slice(1);
    readSub('professores', out.rest, out);
    return;
```

por:

```js
    out.screen = 'professores';
    out.rest = segs.slice(1);
    if (out.rest.length === 1 && lower(out.rest[0]) === 'metas') {
      out.metasAntigas = true;
      return;
    }
    readSub('professores', out.rest, out);
    return;
```

No `accessRedirect`, troque:

```js
  // O professor abre só o próprio perfil: o de outro leva ao dele, na mesma
```

por:

```js
  // O endereço antigo das metas leva à trilha Professor em Configurações →
  // Plano de carreira. Depois da trava de tela: sem o módulo, ou sem ser
  // gestor, o aviso é o da tela Professores.
  if (route.metasAntigas) {
    const destino = hrefFor(tenantId, 'settings', { sub: 'carreira', trilhaId: 'professor' });
    if (destino) return redirectTo(destino);
  }
  // O professor abre só o próprio perfil: o de outro leva ao dele, na mesma
```

O id `'professor'` vai escrito porque o `routes.js` não importa `src/lib/carreira/` (é o `TRILHA_PROFESSOR` de `trilhas.js`).

- [ ] **Step 4: Remove the Metas tab and add the link**

Em `src/views/professores/ProfessoresView.jsx`:

Troque:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';
```

por:

```js
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { hrefFor } from '../../lib/routes.js';
import { TRILHA_PROFESSOR } from '../../lib/carreira/trilhas.js';
```

Apague a linha:

```js
import { MetasForm } from './MetasForm.jsx';
```

Troque:

```js
// A tela Professores do gestor (mockup A de 25/11/2026): a lista de placar e
// as sub-telas Pesquisas (mockup B das pesquisas) e Metas. O ciclo mora no
// endereço (`ciclo`), e a aba é a sub-tela (/professores, /professores/pesquisas
// e /professores/metas), que o App troca com replace.
```

por:

```js
// A tela Professores do gestor (mockup A de 25/11/2026): a lista de placar e
// a sub-tela Pesquisas (mockup B das pesquisas). O ciclo mora no endereço
// (`ciclo`), e a aba é a sub-tela (/professores e /professores/pesquisas), que
// o App troca com replace. As metas moram em Configurações → Plano de carreira,
// na trilha Professor (o link "Metas da trilha").
```

Troque:

```js
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas, metas, salvarMetas, trilhaProfessor } = dados;
```

por:

```js
  const { carregando, erro, professores, planos, contratos, clientes, aulas, presencas, metas, trilhaProfessor } = dados;
```

Troque:

```js
  const aba = tab === 'metas' || tab === 'pesquisas' ? tab : 'lista';
```

por:

```js
  const aba = tab === 'pesquisas' ? tab : 'lista';
  const metasHref = hrefFor(tenantId, 'settings', { sub: 'carreira', trilhaId: TRILHA_PROFESSOR });
```

Troque:

```jsx
        <CicloControl ciclo={ciclo} cicloAtual={ctx.cicloAtual} onCiclo={(c) => setParams({ ciclo: c })} />
      </FilterBar>
```

por:

```jsx
        <CicloControl ciclo={ciclo} cicloAtual={ctx.cicloAtual} onCiclo={(c) => setParams({ ciclo: c })} />
        {metasHref && (
          <AppLink to={metasHref} className="inline-flex h-[38px] items-center rounded-xl border border-border bg-card px-3 text-[13px] font-semibold shadow-card outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
            Metas da trilha
          </AppLink>
        )}
      </FilterBar>
```

Troque:

```jsx
            <TabsTrigger value="pesquisas" className={TAB_TRIGGER}>Pesquisas</TabsTrigger>
            <TabsTrigger value="metas" className={TAB_TRIGGER}>Metas</TabsTrigger>
          </TabsList>
```

por:

```jsx
            <TabsTrigger value="pesquisas" className={TAB_TRIGGER}>Pesquisas</TabsTrigger>
          </TabsList>
```

E apague o painel das metas:

```jsx
          <TabsContent value="metas" tabIndex={-1}>
            {metas
              ? <MetasForm metas={metas} salvarMetas={salvarMetas} academia={academiaTaxa} />
              : <p className="text-[13px] text-muted-foreground">Carregando as metas…</p>}
          </TabsContent>
```

- [ ] **Step 5: Remove salvarMetas from useProfessoresDados**

Em `src/hooks/useProfessoresDados.js`:

Troque:

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { appId, CONFIG_PATH, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
```

por:

```js
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, PRESENCAS_PATH } from '../lib/firebase.js';
```

Troque:

```js
// `metas` é null até a primeira resposta, e `carregando` fica verdadeiro até
// as três leituras responderem.
const CARREIRA_ID = 'carreira';
const CLIENTES_SPEC_KEY = 'professores-clientes';
```

por:

```js
// `metas` é null até a primeira resposta, e `carregando` fica verdadeiro até
// as três leituras responderem. As metas de hoje ficam só para leitura: quem
// grava é Configurações → Plano de carreira, no campo `trilhas`.
const CLIENTES_SPEC_KEY = 'professores-clientes';
```

Apague o bloco:

```js
  // O documento inteiro: o formulário das metas tem todas elas.
  const salvarMetas = useCallback(
    (m) => setDoc(doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CARREIRA_ID), m),
    [db],
  );

```

E, no objeto devolvido, troque:

```js
    trilhaProfessor,
    salvarMetas,
  };
```

por:

```js
    trilhaProfessor,
  };
```

Confira que nada mais usa o `salvarMetas`: `grep -rn "salvarMetas" src` deve voltar vazio.

- [ ] **Step 6: Delete the form**

```bash
git rm src/views/professores/MetasForm.jsx
```

O `problemaDasMetas` (em `src/lib/professor/metas.js`) e o `escalaDaRenovacao` (em `criterios.js`) ficam: o primeiro tem teste próprio (`professor.metas.test.js`) e o segundo é usado pelo `PlacarDoCiclo.jsx`. O PR 3 decide se o `problemaDasMetas` sai.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/lib/__tests__/routes.professores.test.js src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/professorPerfil.behavior.test.js src/lib/__tests__/routes.test.js src/lib/__tests__/routes.decision.test.js src/lib/__tests__/routes.carreira.test.js && npx eslint src/views/professores/ src/hooks/useProfessoresDados.js src/lib/routes.js src/lib/__tests__/professoresView.behavior.test.js`
Expected: PASS e lint sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/lib/routes.js src/views/professores/ProfessoresView.jsx src/hooks/useProfessoresDados.js src/lib/__tests__/routes.professores.test.js src/lib/__tests__/professoresView.behavior.test.js src/lib/__tests__/professorPerfil.behavior.test.js
git commit -m "feat: metas dos professores saem para Configurações, Plano de carreira"
```

---

### Task 11: CLAUDE.md e a verificação inteira

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Plano de carreira" section**

Em `CLAUDE.md`, troque:

```md
O gestor monta as trilhas de carreira (Consultor, Professor, Estagiário e as que criar), com níveis, tempo mínimo e metas por nível. Spec em `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md` e visão geral dos PRs em `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`. O PR 1 trouxe só as contas, sem tela nova.
```

por:

```md
O gestor monta as trilhas de carreira (Consultor, Professor, Estagiário e as que criar), com níveis, tempo mínimo e metas por nível. Spec em `docs/superpowers/specs/2026-11-26-plano-de-carreira-configuravel-design.md` e visão geral dos PRs em `docs/superpowers/plans/2026-11-26-plano-de-carreira-00-visao-geral.md`. O PR 1 trouxe só as contas, sem tela nova. O PR 2 (plano em `docs/superpowers/plans/2026-11-26-plano-de-carreira-02-configuracoes.md`) trouxe Configurações → Plano de carreira.
```

E, logo depois do item `- **O que se recusa numa trilha** ...` (o último da seção), acrescente:

```md
- **Configurações → Plano de carreira** (PR 2, mockup A em `docs/superpowers/specs/mockups/2026-11-26-carreira-editor-a.html`). Seção `carreira` do trilho, no grupo Equipe, depois de Equipe & acessos, só para o gestor e só com o módulo `faltosos` (`modulo` no item de `settingsRail.js`; sem o módulo, `settingsSection` cai na seção padrão). A tela mora em `src/views/settings/carreira/`: `CarreiraSettingsSection` (lista e qual trilha abre), `TrilhaEditor` (cabeçalho, abas e barra de salvar), `TrilhaGrade` (Níveis e metas), `TrilhaRegras` (Regras da trilha), `CampoNumero` e `carreiraTexto.js` (textos, ícones e classes, em JS sem JSX).
  - **Endereço:** `/configuracoes/carreira` (lista), `/configuracoes/carreira/<id>` (Níveis e metas) e `/<id>/regras`, lidos à parte no `readScreen` (`trilhaId` e `trilhaAba`, no `screenState` e no alvo do redirect). A trilha não entra na `screenKey`, para abrir uma trilha não remontar as Configurações. Abrir a trilha e voltar são links (push), trocar de aba é replace pelo `goToSub`, e arquivar ou descartar a trilha nova voltam à lista com replace. O id que não existe, ou de trilha arquivada, mostra a lista. O Sentry troca o id por `:trilhaId`.
  - **O rascunho é da trilha, não da aba.** As operações são puras em `src/lib/carreira/rascunho.js` (trilha nova, níveis, números, metas, ajustes, calendário, base, pessoas por nível, `trilhaParaGravar` e `mudou`). A trilha nova vive no estado da seção até salvar, com id `trilha-` mais 6 sorteados; o nível novo, `nivel-` mais 6.
  - **Gravação:** `salvarTrilha` (`src/lib/carreiraWrites.js`) roda o `problemaDaTrilha` de novo, recusa arquivar com gente e grava o campo `trilhas.<id>` inteiro por `updateDoc` com `FieldPath`, sem mesclar, com `updatedAt` e `updatedBy`. Sem o documento, cria com `setDoc` e `merge`. Nenhuma regra do Firestore mudou. O documento antigo das metas (o topo) não é apagado.
  - **Pessoas por nível** (`pessoasPorNivel`): professores ativos (o sem trilha é da Professor) e usuários com o papel consultor, contados na trilha como está gravada, com `_semNivel` para quem está num nível que não existe. Apagar nível com gente e arquivar trilha com gente ficam desligados com o motivo (`aria-disabled`, e o clique mostra o motivo num aviso).
  - **Vendas:** o campo é em mil reais e a gravação em reais; trocar entre reais e quantidade apaga as metas de vendas. Trocar a frequência leva o mês ao padrão dela.
  - **Trava do PR 2:** na trilha Professor, a frequência e o mês da avaliação ficam desligados com o aviso "O calendário da trilha Professor muda a partir do menu Carreira." (`AVISO_CALENDARIO_PROFESSOR`), porque o NPS das telas de hoje já lê essa trilha e os outros números usam o ciclo fixo de dezembro. O PR 3 tira a trava e o teste dela (`carreiraEditor.behavior.test.js`).
  - **As telas de Professores seguem com as metas de antes** (`metasDe`, no topo do documento) até o PR 3, que passa a ler a trilha. A sub-tela `/professores/metas` e o `MetasForm` saíram, o endereço antigo leva a `/configuracoes/carreira/professor` (`metasAntigas`, no `routes.js`), e a tela Professores tem o link "Metas da trilha". O `salvarMetas` saiu do `useProfessoresDados`, porque gravava o documento inteiro sem `merge` e apagaria as trilhas.
  - **Leitura:** a assinatura de `stronix_config/carreira` mora no `useCarreira` (`src/hooks/`), que o `useProfessoresDados` e a seção usam. A `SettingsView` recebe o `listenersActive` do App.
```

- [ ] **Step 2: Update the professor profile and address sections**

Ainda em `CLAUDE.md`, troque:

```md
  - **Metas:** `stronix_config/carreira`, lido por `metasDe` com padrão campo a campo (`METAS_PADRAO`, em `src/lib/professor/metas.js`) e gravado inteiro pelo gestor. O formulário confere pelo `problemaDasMetas`.
```

por:

```md
  - **Metas:** `stronix_config/carreira`, lido por `metasDe` com padrão campo a campo (`METAS_PADRAO`, em `src/lib/professor/metas.js`). Desde o PR 2 do plano de carreira, ninguém grava mais o topo do documento: as metas são as da trilha Professor, em Configurações → Plano de carreira, e as telas passam a lê-las no PR 3.
```

Troque:

```md
- **Sub-tela no caminho: `/configuracoes/<secao>` (doze seções),
```

por:

```md
- **Sub-tela no caminho: `/configuracoes/<secao>` (treze seções, e a trilha do Plano de carreira em `/configuracoes/carreira/<id>` e `/<id>/regras`),
```

Troque:

```md
São doze seções em sete blocos
```

por:

```md
São treze seções em sete blocos
```

Troque:

```md
Equipe; Dia a dia (Metas & ritmo, Agendamento, Rotinas)
```

por:

```md
Equipe (Equipe & acessos e, com o módulo `faltosos`, Plano de carreira); Dia a dia (Metas & ritmo, Agendamento, Rotinas)
```

- [ ] **Step 3: Run the whole verification**

Run: `npm run lint && npm test && npm run verificar:sentry && npm run build`
Expected: lint sem erro, todos os testes PASS, a verificação do Sentry limpa e o build sem erro.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Configurações, Plano de carreira no CLAUDE.md do Stronilead"
```

- [ ] **Step 5: Look at it in a browser before opening the PR**

Sem login e sem gravar no banco de produção, pelo harness local do Vite com os fakes do Firebase (ver a memória "Harness no navegador sem login"): abra `/acad/configuracoes/carreira` com o módulo ligado, confira a lista, abra a Professor, troque de aba, edite uma meta, desligue um número, apague o Sênior e acrescente um nível, em 1280 px e em 375 px, no claro e no escuro. Compare com o mockup A. Não teste no Firebase de produção.

Ao fim, sugira ao Johnny de 3 a 8 ciclos de code review, como pede o `AGENTS.md`: por exemplo, a gravação pelo caminho do campo e a corrida entre abas, a regra das pessoas por nível contra o `problemaDaTrilha`, o endereço e o redirect de `/professores/metas`, a acessibilidade do editor (foco, `aria-disabled`, regiões vivas) e o desenho contra o mockup.

---

## Self-review

**Cobertura da spec e das decisões do Johnny:**

- Seção no grupo Equipe, depois de Equipe & acessos, só gestor e só com o módulo: Task 5 (`settingsRail.js`) e Task 9 (a `SettingsView` só monta para gestor).
- Endereços `/configuracoes/carreira`, `/<id>` e `/<id>/regras`, aba por replace, id que não existe cai na lista: Tasks 4, 8 e 9.
- `salvarTrilha` com `updateDoc` pelo caminho do campo, `setDoc` com `merge` sem documento, `problemaDaTrilha` antes, `updatedAt` e `updatedBy`: Task 2.
- Rascunho da trilha, puro, com teste, e `carreiraImports.test.js` atualizado: Task 1.
- Trilha nova com a base, um nível, números ligados com metas em branco, anual em dezembro, id sem colisão e ordem depois da última: Task 1 (`novaTrilha`) e Task 8 (Popover).
- Pessoas por nível pelos professores ativos e pelos consultores, apagar nível e arquivar com gente desligados com o motivo: Tasks 1, 7 e 8.
- Trava da frequência e do mês da trilha Professor, com teste e a nota de que o PR 3 tira: Task 7 e CLAUDE.md.
- `/professores/metas` e o `MetasForm` saem, endereço antigo com replace, testes ajustados, documento antigo não apagado: Task 10 (o `RouteRedirect` do App troca o endereço com replace).
- Meta em reais no campo em mil e gravação em reais: Task 6 (`unidadeDe`, `CampoNumero`) e Task 7 (teste).
- Testes pedidos (rascunho, writes, tela em jsdom com cada caso, `routes.test`, `sentryScrub`, `settingsRail.test`): Tasks 1, 2, 4, 5, 7 e 8.
- CLAUDE.md e a verificação inteira: Task 11.
- Mockup: cabeçalho com ícone, nome, etiquetas e "Arquivar trilha" discreto, abas no cabeçalho, degraus, "+ Nível" na última coluna, tempo mínimo na primeira linha, liga e desliga com ícone, nome e legenda, unidade dentro do campo, "sem meta" tracejado, "Não conta nesta trilha", rodapé da grade com o link das regras, barra de salvar presa, três blocos de regras, cartões da lista com mini escada e arquivadas recolhidas: Tasks 7 e 8.

**Busca de lacunas:** nenhum "TBD", "TODO" nem "igual à task N"; todo passo com código mostra o código.

**Nomes conferidos entre tarefas:** `novaTrilha`, `acrescentarNivel`, `apagarNivel`, `renomearNivel`, `trocarMeses`, `ligarNumero`, `trocarMeta`, `trocarAjuste`, `trocarFrequencia`, `trocarBase`, `trocarSugestao`, `com`, `metasEmBranco`, `pessoasPorNivel`, `totalDePessoas`, `motivoDoApagar`, `trilhaParaGravar`, `mudou`, `SEM_NIVEL` e `MOTIVO_DO_ARQUIVAR` (Task 1) são os que as Tasks 2, 7 e 8 importam. `salvarTrilha(db, { trilha, gravada, outras, pessoasPorNivel, appUser })` (Task 2) é a chamada da Task 8. `useCarreira({ db, listenersActive })` devolve `{ carreira, trilhas }` (Task 3), que a Task 8 e o teste dela usam. `hrefFor(..., { sub: 'carreira', trilhaId, trilhaAba })` (Task 4) é o da Task 8, da Task 9 e do redirect da Task 10. `settingsRailGroups(canImport, modules)` e `settingsSection(section, canImport, modules)` (Task 5) são as da Task 9. As props do `TrilhaEditor` (`inicial`, `gravada`, `outras`, `pessoas`, `aba`, `onAba`, `voltarHref`, `modalities`, `onSalvar`, `onArquivar`, `onDescartarNova`) são as mesmas no teste da Task 7 e na seção da Task 8. As da seção (`db`, `appUser`, `usersList`, `listenersActive`, `tenantSlug`, `trilhaId`, `trilhaAba`, `onAba`) são as da `SettingsView` na Task 9 e do teste da Task 8.
