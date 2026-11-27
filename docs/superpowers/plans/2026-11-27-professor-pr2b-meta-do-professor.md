# Meta diária do professor (2B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o aviso provisório da Meta diária do professor pela tela dos faltosos dele (desenho "Foco agora", versão 2 do bloco Agora), com a Agenda de hoje só das aulas dele, o "Registrar contato" e o "Já voltou", o seletor "Ver a Meta de" para o gestor, o aviso "Quer cancelar" no sino e os alunos Sem professor e Não achados no bloco Faltosos de Configurações.

**Architecture:** A regra da tela é pura e mora em `src/lib/faltosos/metaProfessor.js` (quem está pendente, a ordem, a semana, os textos). A gravação do contato monta o lote em `src/lib/faltosos/contatoDeFalta.js` (puro) e grava em `src/lib/faltosos/contatoDeFaltaWrites.js`: uma interação `absence_contact` e a tarefa em `stronix_faltosos`, num lote só, sem tocar o lead. A tela é um componente próprio (`src/components/dailygoal/professor/`), que reaproveita as peças genéricas da Meta do consultor (`FocoBar`, `SideCard`, `SideSection`, o kit de pop-ups), mas não o `MetaFocoScreen`, que é preso às categorias do consultor. Uma rota fina (`src/views/MetaDiariaRoute.jsx`) decide entre a Meta do consultor e a do professor, pelo papel e pelo parâmetro `prof` do endereço.

**Tech Stack:** React 19, Firebase (Firestore) no navegador, Tailwind v4, shadcn/ui (Dialog, RadioGroup), Vitest com jsdom nos testes de tela.

**Spec:** adendo de 27/11/2026 em `docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md` e, para o que ele não muda, "A Meta do professor" e "O sino do gestor" em `docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md`. Mockup aprovado: `docs/superpowers/specs/mockups/2026-11-27-meta-professor-a-foco.html`.

---

## Decisões tomadas neste plano

| | Caso | Decisão |
|---|---|---|
| P1 | O contato toca o lead? | Não. A spec diz que o contato de falta não altera o lead. A interação é gravada no lote à mão (não pelo `logInteraction`, que sempre soma `lastInteractionAt` e `interactionsCount`), com os mesmos campos de autoria. Ela fica fora do "Já interagido hoje" (`hasActiveInteractionToday`) e do primeiro contato do Dashboard CRM (`isContactInteraction`), como a `presence_return`. |
| P2 | Onde aparece na ficha | Tipo `absence_contact`, classificado como `conversation` (filtro Conversas), com o rótulo "Contato de falta". O texto gravado é "Contato de falta (14 dias), WhatsApp: vai voltar." mais a observação. |
| P3 | O que a tarefa guarda | Os campos que a importação já cria vazios: `status` (`feita` ou `voltou`), `feitaEm` (hora do servidor), `feitaPor` (id do cadastro), `feitaPorNome`, `canal` (`whatsapp`, `ligacao`, `pessoalmente`; `null` no "Já voltou") e `resultado` (`vai_voltar`, `respondeu`, `nao_respondeu`, `quer_cancelar`; `null` no "Já voltou"). |
| P4 | Quer cancelar | O estado do aluno ganha `querCancelarEm` (hora do servidor), `querCancelarPorNome` e `querCancelarAluno` (o nome do aluno, para o sino não precisar ler o lead). A importação já carrega o `querCancelarEm`, e os outros dois sobrevivem porque ela refaz o documento a partir do atual. |
| P5 | Quem grava a tarefa | O gestor pelo `isAdmin`, como hoje. O professor por uma condição nova na mesma linha de update (`professorFaltosoOk`): só aluno com o `professorId` dele, só os campos da tarefa e do "Quer cancelar", só de `pendente` para `feita` ou `voltou`, e o `feitaEm` com a hora do servidor. |
| P6 | Semana | A semana começa na última importação (`ultimaImportacao.importadoEm`). "Feitos nesta semana" são as tarefas com `feitaEm` a partir dela. Pendentes são as tarefas `pendente` do período atual, de qualquer semana. |
| P7 | Ordem | Urgentes primeiro; dentro de cada grupo, mais dias sem vir primeiro; empate pelo nome. |
| P8 | Dias sem vir | Contados até hoje no calendário de Brasília (`diasEntre(ultimaPresenca, hojeEmBrasilia(now))`), e não o `diasNaImportacao`. |
| P9 | Leitura dos faltosos | `stronix_faltosos` com `where('professorId', '==', id)`, ao vivo e com o portão de ociosidade. O filtro de situação é no navegador, sem índice composto. Os leads dos alunos são lidos por id, em lotes de 30, uma vez por id. |
| P10 | Agenda de hoje | `stronix_aulas` com `scheduledFor` no dia (índice automático), ao vivo e com o portão. O filtro de aula (`isAulaRecord`), de professor (`professorId`) e de cancelada é no navegador. Só para ver (decisão do Johnny, 27/11/2026). A quantidade de aulas fica fora: o registro não a guarda. |
| P11 | Seletor do gestor | Parâmetro `prof` na tela `dailyGoal`, só para o gestor com o módulo. Ausente é a Meta dele. Professor inativo ou que não existe cai na Meta dele, sem aviso. |
| P12 | Efeito de troca | Classes `meta-entra` (bloco Agora) e `meta-voltou` (linha da fila) no `index.css`, desligadas no bloco de movimento reduzido. Só a troca por ação de quem usa a tela anima. |
| P13 | O aviso provisório | `ProfessorGoalPlaceholder` sai. O professor sem professor ligado vê a mesma frase dentro da tela nova. |

## Riscos conhecidos

1. **Gravação perdida na corrida com a importação.** A importação relê os estados do servidor, refaz o plano e grava cada estado inteiro, sem merge. Um contato registrado entre essa leitura e o fim do lote se perde no estado (a interação fica). A janela é de segundos, uma vez por semana, e só o gestor importa. O comentário fica no `contatoDeFaltaWrites.js`. Trocar a importação por transação fica fora deste PR.
2. **Regras.** Mudam duas funções e uma linha de `stronix_faltosos`. A publicação é a do 2A: ler a regra no ar, aplicar só o diff deste PR, validar e publicar com o OK do Johnny antes do merge.
3. **Leitura dos faltosos por professor.** A consulta traz também os alunos que já voltaram ou encerraram, de todo o histórico. Hoje são dezenas por professor. Se crescer, trocar por `status == 'faltando'` mais o professor, com índice composto (comentário `shortcut:` no hook).

---

## Mapa de arquivos

| Arquivo | O que faz |
|---|---|
| Create `src/lib/faltosos/metaProfessor.js` | Regra pura da tela: pendentes, feitos, ordem, grupos, textos |
| Create `src/lib/faltosos/contatoDeFalta.js` | Monta a interação e o patch da tarefa (puro) |
| Create `src/lib/faltosos/contatoDeFaltaWrites.js` | Grava o lote no Firestore |
| Modify `src/lib/leads.js` | `ABSENCE_CONTACT_TYPE`; fora do "Já interagido hoje" |
| Modify `src/lib/crm/contact.js` | Fora do primeiro contato |
| Modify `src/lib/timeline.js` | `conversation` e o rótulo "Contato de falta" |
| Modify `src/lib/professorWrites.js` | `absence_contact` em `PROFESSOR_INTERACTION_TYPES` |
| Modify `firestore.rules` | `professorInteractionTypes()`, `professorFaltosoOk()`, linha de update de `stronix_faltosos` |
| Create `src/hooks/useFaltososDoProfessor.js` | Estados e leads dos faltosos de um professor |
| Create `src/hooks/useAulasDeHojeDoProfessor.js` | Aulas experimentais de hoje de um professor |
| Create `src/hooks/useQuerCancelar.js` | "Quer cancelar" dos últimos 30 dias, para o sino do gestor |
| Create `src/hooks/useRegistroDaImportacao.js` | Registro da última importação (Não achados) |
| Create `src/components/dailygoal/professor/*` | A tela: `ProfessorMetaScreen`, `AgoraFalta`, `FilaFaltosos`, `AgendaDoProfessor`, `RegistrarContatoDialog`, `SeletorDeMeta` |
| Create `src/views/MetaDiariaRoute.jsx` | Decide entre a Meta do consultor e a do professor |
| Modify `src/lib/screenParams.js` | Parâmetro `prof` da `dailyGoal` |
| Modify `src/App.jsx` | Monta a rota e o sino |
| Modify `src/lib/notifications.js`, `src/components/layout/NotificationBell.jsx` | Grupo "Querem cancelar" |
| Modify `src/views/settings/FaltososPanel.jsx` | Sem professor e Não achados |
| Modify `src/index.css` | Efeito de troca e movimento reduzido |
| Delete `src/views/ProfessorGoalPlaceholder.jsx`, `src/lib/__tests__/professorGoalPlaceholder.test.js` | O aviso provisório |
| Modify `CLAUDE.md` | Seção "Meta diária do professor" |

---

### Task 0: Preparação

- [ ] **Step 1: Branch a partir da main, com o adendo e os mockups**

```bash
git fetch origin && git switch -c claude/professor-pr2b-impl origin/main
git cherry-pick a230ba5 347810e 13eb668 891d37f   # adendo da spec e mockups, da branch claude/professor-pr2b
```

- [ ] **Step 2: Dependências e linha de base**

```bash
npm ci && git diff --exit-code package-lock.json
npm run lint && npm test && npm run verificar:sentry && npm run build
```
Expected: tudo verde. Anote o número de testes.

---

### Task 1: Regra pura da tela (`src/lib/faltosos/metaProfessor.js`)

**Files:**
- Create: `src/lib/faltosos/metaProfessor.js`
- Test: `src/lib/__tests__/faltosos.metaProfessor.test.js`
- Modify: `src/lib/__tests__/faltosos.imports.test.js` (o arquivo novo entra na lista dos puros)

- [ ] **Step 1: Escrever o teste**

```js
// A regra da Meta diária do professor (src/lib/faltosos/metaProfessor.js).
import { describe, it, expect } from 'vitest';
import {
  pendentesDe, feitosDaSemana, gruposDaSemana, diasSemVir, motivoDe, fraseDe, resultadoTexto,
  RESULTADOS, CANAIS,
} from '../faltosos/metaProfessor.js';

const HOJE = '2026-11-27';
const est = (id, extra = {}) => ({
  id, leadId: id, status: 'faltando', professorId: 'p1', ultimaPresenca: '2026-11-06', inicioFalta: '2026-11-06',
  urgente: false, contratoTerminaEm: '2027-06-11',
  tarefa: { marco: 14, urgente: false, status: 'pendente', inicioFalta: '2026-11-06', criadaEm: '2026-11-23', importacaoId: 'f2026-11-23', feitaEm: null },
  ...extra,
});
const ts = (iso) => ({ toMillis: () => Date.parse(iso) });

describe('pendentes', () => {
  it('só faltando, com tarefa pendente do período atual', () => {
    const docs = [
      est('a'),
      est('b', { status: 'voltou' }),
      est('c', { tarefa: { ...est('c').tarefa, status: 'feita' } }),
      est('d', { tarefa: { ...est('d').tarefa, inicioFalta: '2026-09-01' } }),
      est('e', { tarefa: null }),
    ];
    expect(pendentesDe(docs, HOJE).map((d) => d.id)).toEqual(['a']);
  });

  it('urgentes primeiro, depois mais dias sem vir, depois o nome', () => {
    const docs = [
      est('x', { ultimaPresenca: '2026-11-16' }),
      est('y', { ultimaPresenca: '2026-10-21' }),
      est('z', { ultimaPresenca: '2026-11-20', urgente: true }),
      est('w', { ultimaPresenca: '2026-10-21' }),
    ];
    const nomes = { x: 'Xavier', y: 'Yara', z: 'Zeca', w: 'Wagner' };
    expect(pendentesDe(docs, HOJE, (id) => nomes[id]).map((d) => d.id)).toEqual(['z', 'w', 'y', 'x']);
  });
});

describe('feitos da semana', () => {
  it('feita ou voltou com feitaEm a partir da última importação', () => {
    const desde = new Date('2026-11-23T12:00:00Z');
    const docs = [
      est('a', { tarefa: { ...est('a').tarefa, status: 'feita', feitaEm: ts('2026-11-24T10:00:00Z') } }),
      est('b', { status: 'voltou', tarefa: { ...est('b').tarefa, status: 'voltou', feitaEm: ts('2026-11-25T10:00:00Z') } }),
      est('c', { tarefa: { ...est('c').tarefa, status: 'feita', feitaEm: ts('2026-11-20T10:00:00Z') } }),
      est('d', { status: 'voltou', tarefa: { ...est('d').tarefa, status: 'voltou', feitaEm: null } }),
    ];
    expect(feitosDaSemana(docs, desde).map((d) => d.id)).toEqual(['b', 'a']);
  });

  it('sem importação, nada conta como da semana', () => {
    expect(feitosDaSemana([est('a', { tarefa: { ...est('a').tarefa, status: 'feita', feitaEm: ts('2026-11-24T10:00:00Z') } })], null)).toEqual([]);
  });
});

describe('grupos e textos', () => {
  it('conta urgentes e cada marco', () => {
    const docs = [est('a', { urgente: true }), est('b'), est('c', { tarefa: { ...est('c').tarefa, marco: 30 } })];
    expect(gruposDaSemana(docs, [7, 14, 30, 60])).toEqual([
      { id: 'urgentes', nome: 'Urgentes', total: 1 },
      { id: '60', nome: '60 dias sem vir', total: 0 },
      { id: '30', nome: '30 dias sem vir', total: 1 },
      { id: '14', nome: '14 dias sem vir', total: 1 },
      { id: '7', nome: '7 dias sem vir', total: 0 },
    ]);
  });

  it('dias sem vir até hoje, em Brasília', () => {
    expect(diasSemVir(est('a'), HOJE)).toBe(21);
    expect(diasSemVir(est('a', { ultimaPresenca: null }), HOJE)).toBeNull();
  });

  it('motivo e frase', () => {
    expect(motivoDe(est('a'))).toBe('Marco dos 14 dias sem vir');
    expect(motivoDe(est('a', { urgente: true, contratoTerminaEm: '2026-12-10' }))).toBe('Urgente: o contrato termina em 10/12');
    expect(fraseDe(est('a'), HOJE)).toEqual({ dias: 21, desde: '06/11', termina: null });
    expect(fraseDe(est('a', { urgente: true, contratoTerminaEm: '2026-12-10' }), HOJE)).toEqual({ dias: 21, desde: '06/11', termina: '10/12' });
  });

  it('listas e texto do resultado', () => {
    expect(RESULTADOS.map((r) => r.id)).toEqual(['vai_voltar', 'respondeu', 'nao_respondeu', 'quer_cancelar']);
    expect(CANAIS.map((c) => c.id)).toEqual(['whatsapp', 'ligacao', 'pessoalmente']);
    expect(resultadoTexto('quer_cancelar')).toBe('Quer cancelar');
    expect(resultadoTexto(null)).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.metaProfessor.test.js`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 3: Criar `src/lib/faltosos/metaProfessor.js`**

```js
// Regra da Meta diária do professor (adendo de 27/11/2026 da spec
// 2026-10-16-professor-pr2-em-tres-partes-design.md). Pura: a tela, o sino e os
// testes leem daqui. Não importa pacote nem firebase.js.
import { diasEntre, ddmm } from './dias.js';
import { STATUS, TAREFA } from './planoImportacao.js';

export const CANAIS = Object.freeze([
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'ligacao', label: 'Ligação' },
  { id: 'pessoalmente', label: 'Pessoalmente' },
]);

export const RESULTADOS = Object.freeze([
  { id: 'vai_voltar', label: 'Vai voltar', desc: 'Combinou de voltar a treinar.', tone: 'ok' },
  { id: 'respondeu', label: 'Respondeu', desc: 'Conversou, mas sem data para voltar.', tone: 'later' },
  { id: 'nao_respondeu', label: 'Não respondeu', desc: 'Mandou mensagem ou ligou e ficou sem resposta.', tone: 'later' },
  { id: 'quer_cancelar', label: 'Quer cancelar', desc: 'O gestor recebe o aviso no sino.', tone: 'no' },
]);

export const resultadoTexto = (id) => RESULTADOS.find((r) => r.id === id)?.label || '';
export const canalTexto = (id) => CANAIS.find((c) => c.id === id)?.label || '';

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : null);

export const diasSemVir = (doc, hojeDia) => (doc?.ultimaPresenca ? diasEntre(doc.ultimaPresenca, hojeDia) : null);

// Pendente: o aluno está faltando e a tarefa é deste período e está aberta. É a
// mesma conta do planoImportacao (a tarefa de um período anterior não vale).
export const ehPendente = (d) => d?.status === STATUS.FALTANDO
  && d?.tarefa?.status === TAREFA.PENDENTE
  && d.tarefa.inicioFalta === d.inicioFalta;

export function pendentesDe(docs, hojeDia, nomeDe = () => '') {
  return (docs || []).filter(ehPendente).sort((a, b) => (
    (Number(Boolean(b.urgente)) - Number(Boolean(a.urgente)))
    || ((diasSemVir(b, hojeDia) ?? 0) - (diasSemVir(a, hojeDia) ?? 0))
    || String(nomeDe(a.id) || '').localeCompare(String(nomeDe(b.id) || ''), 'pt-BR')
  ));
}

// Feitos desde a última importação, o mais recente primeiro. "Voltou" pela
// importação não tem feitaEm e não conta: ninguém fez o contato.
export function feitosDaSemana(docs, desde) {
  const inicio = ms(desde);
  if (inicio == null) return [];
  return (docs || [])
    .filter((d) => [TAREFA.FEITA, TAREFA.VOLTOU].includes(d?.tarefa?.status) && (ms(d.tarefa.feitaEm) ?? -1) >= inicio)
    .sort((a, b) => ms(b.tarefa.feitaEm) - ms(a.tarefa.feitaEm));
}

export function gruposDaSemana(pendentes, marcos) {
  const lista = pendentes || [];
  return [
    { id: 'urgentes', nome: 'Urgentes', total: lista.filter((d) => d.urgente).length },
    ...[...(marcos || [])].sort((a, b) => b - a).map((m) => ({
      id: String(m), nome: `${m} dias sem vir`, total: lista.filter((d) => !d.urgente && d.tarefa?.marco === m).length,
    })),
  ];
}

export const motivoDe = (d) => (d?.urgente
  ? `Urgente: o contrato termina em ${ddmm(d.contratoTerminaEm)}`
  : `Marco dos ${d?.tarefa?.marco} dias sem vir`);

export const fraseDe = (d, hojeDia) => ({
  dias: diasSemVir(d, hojeDia),
  desde: ddmm(d?.ultimaPresenca),
  termina: d?.urgente ? ddmm(d.contratoTerminaEm) || null : null,
});
```

> Se `planoImportacao.js` não exportar `STATUS` e `TAREFA`, acrescente `export` nas duas constantes (linhas 23-24) e nada mais.

- [ ] **Step 4: O arquivo novo entra na varredura dos puros**

Em `src/lib/__tests__/faltosos.imports.test.js`, acrescente `'metaProfessor.js'` à lista dos arquivos puros da pasta.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.metaProfessor.test.js src/lib/__tests__/faltosos.imports.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/faltosos/metaProfessor.js src/lib/faltosos/planoImportacao.js src/lib/__tests__/faltosos.metaProfessor.test.js src/lib/__tests__/faltosos.imports.test.js
git commit -m "feat: regra da Meta diária do professor"
```

---

### Task 2: O contato de falta na linha do tempo (`leads.js`, `crm/contact.js`, `timeline.js`)

**Files:**
- Modify: `src/lib/leads.js:228` e `:288`
- Modify: `src/lib/crm/contact.js:23`
- Modify: `src/lib/timeline.js` (`classifyInteraction`, `timelineTypeLabel`)
- Test: `src/lib/__tests__/timeline.test.js`, `src/lib/__tests__/leads.test.js`, `src/lib/__tests__/crm.contact.test.js`

- [ ] **Step 1: Escrever os testes**

`timeline.test.js`:
```js
import { ABSENCE_CONTACT_TYPE } from '../leads.js';
it('o contato de falta é conversa, com o rótulo próprio', () => {
  const i = { type: ABSENCE_CONTACT_TYPE, text: 'Contato de falta (14 dias), WhatsApp: vai voltar.' };
  expect(classifyInteraction(i)).toBe('conversation');
  expect(timelineTypeLabel('conversation', i.text)).toBe('Contato de falta');
});
```
> Confira a assinatura de `timelineTypeLabel` (linha ~382) e passe o que ela recebe.

`leads.test.js` e `crm.contact.test.js`, na forma dos testes vizinhos de `PRESENCE_RETURN_TYPE`:
```js
it('o contato de falta não acende o Já interagido hoje', () => {
  // mesma montagem do teste do PRESENCE_RETURN_TYPE, com type: ABSENCE_CONTACT_TYPE
});
it('o contato de falta não é primeiro contato', () => {
  expect(isContactInteraction({ type: ABSENCE_CONTACT_TYPE })).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/timeline.test.js src/lib/__tests__/leads.test.js src/lib/__tests__/crm.contact.test.js`
Expected: FAIL, `ABSENCE_CONTACT_TYPE` indefinido.

- [ ] **Step 3: Implementar**

`src/lib/leads.js`, logo depois de `PRESENCE_RETURN_TYPE`:
```js
// O contato que o professor registra com o aluno faltoso (Meta diária do
// professor). Não toca o lead e não fecha tarefa da Meta de ninguém.
export const ABSENCE_CONTACT_TYPE = 'absence_contact';
```
No `hasActiveInteractionToday`, ao lado da linha do `PRESENCE_RETURN_TYPE`:
```js
    if (i.type === ABSENCE_CONTACT_TYPE) return false;
```
`src/lib/crm/contact.js`: importar `ABSENCE_CONTACT_TYPE` e acrescentar `&& i.type !== ABSENCE_CONTACT_TYPE` ao `isContactInteraction`.
`src/lib/timeline.js`, no `classifyInteraction`, logo depois do `PRESENCE_RETURN_TYPE`:
```js
  if (i.type === ABSENCE_CONTACT_TYPE) return 'conversation';
```
e no `timelineTypeLabel`, no caso `'conversation'`:
```js
    case 'conversation':
      if (/^Contato de falta/.test(t)) return 'Contato de falta';
      return /^📞|ligaç/i.test(t) ? 'Ligação' : 'WhatsApp';
```

- [ ] **Step 4: Rodar e ver passar**

Run: o mesmo do Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leads.js src/lib/crm/contact.js src/lib/timeline.js src/lib/__tests__/timeline.test.js src/lib/__tests__/leads.test.js src/lib/__tests__/crm.contact.test.js
git commit -m "feat: contato de falta na linha do tempo, fora do contato do lead"
```

---

### Task 3: Montagem e gravação do contato (`contatoDeFalta.js`, `contatoDeFaltaWrites.js`)

**Files:**
- Create: `src/lib/faltosos/contatoDeFalta.js`, `src/lib/faltosos/contatoDeFaltaWrites.js`
- Test: `src/lib/__tests__/faltosos.contatoDeFalta.test.js`

- [ ] **Step 1: Escrever o teste**

```js
import { describe, it, expect } from 'vitest';
import { montarContato, montarJaVoltou, textoDoContato } from '../faltosos/contatoDeFalta.js';
import { ABSENCE_CONTACT_TYPE } from '../leads.js';

const AGORA = { __serverTime: true };
const lead = { id: 'l1', name: 'Marina Albuquerque', consultantId: 'c1', consultantAuthUid: 'ac1' };
const quem = { id: 'u6', authUid: 'a6', name: 'Heloísa Prado' };
const estado = { leadId: 'l1', professorId: 'p1', urgente: false, inicioFalta: '2026-10-14',
  tarefa: { marco: 30, urgente: false, status: 'pendente', inicioFalta: '2026-10-14', criadaEm: '2026-11-23', importacaoId: 'f', feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null } };

describe('montarContato', () => {
  it('interação no nome de quem registrou e tarefa feita', () => {
    const r = montarContato({ lead, estado, quem, canal: 'whatsapp', resultado: 'vai_voltar', observacao: ' Volta segunda. ', agora: AGORA });
    expect(r.interacao).toMatchObject({
      type: ABSENCE_CONTACT_TYPE, leadId: 'l1', leadName: 'Marina Albuquerque', consultantName: 'Heloísa Prado',
      leadConsultantId: 'c1', leadConsultantAuthUid: 'ac1', actorId: 'u6', actorAuthUid: 'a6', createdAt: AGORA,
      canal: 'whatsapp', resultado: 'vai_voltar', marco: 30, urgente: false, inicioFalta: '2026-10-14', professorId: 'p1',
      text: 'Contato de falta (30 dias), WhatsApp: vai voltar. Volta segunda.',
    });
    expect(r.estadoPatch).toEqual({
      tarefa: { ...estado.tarefa, status: 'feita', feitaEm: AGORA, feitaPor: 'u6', feitaPorNome: 'Heloísa Prado', canal: 'whatsapp', resultado: 'vai_voltar' },
    });
  });

  it('quer cancelar marca o estado para o sino', () => {
    const r = montarContato({ lead, estado, quem, canal: 'ligacao', resultado: 'quer_cancelar', observacao: '', agora: AGORA });
    expect(r.estadoPatch).toMatchObject({ querCancelarEm: AGORA, querCancelarPorNome: 'Heloísa Prado', querCancelarAluno: 'Marina Albuquerque' });
    expect(r.interacao.text).toBe('Contato de falta (30 dias), Ligação: quer cancelar.');
  });

  it('no urgente, o texto diz urgente', () => {
    const r = montarContato({ lead, estado: { ...estado, urgente: true }, quem, canal: 'pessoalmente', resultado: 'respondeu', observacao: '', agora: AGORA });
    expect(r.interacao.text).toBe('Contato de falta (urgente), Pessoalmente: respondeu.');
  });

  it('recusa tarefa que não está pendente, canal ou resultado desconhecido', () => {
    const feita = { ...estado, tarefa: { ...estado.tarefa, status: 'feita' } };
    expect(() => montarContato({ lead, estado: feita, quem, canal: 'whatsapp', resultado: 'vai_voltar', agora: AGORA })).toThrow();
    expect(() => montarContato({ lead, estado, quem, canal: 'fax', resultado: 'vai_voltar', agora: AGORA })).toThrow();
    expect(() => montarContato({ lead, estado, quem, canal: 'whatsapp', resultado: 'talvez', agora: AGORA })).toThrow();
  });
});

describe('montarJaVoltou', () => {
  it('fecha a tarefa como voltou, sem interação', () => {
    expect(montarJaVoltou({ estado, quem, agora: AGORA })).toEqual({
      tarefa: { ...estado.tarefa, status: 'voltou', feitaEm: AGORA, feitaPor: 'u6', feitaPorNome: 'Heloísa Prado', canal: null, resultado: null },
    });
  });
});

it('a observação vai até 500 caracteres', () => {
  expect(textoDoContato({ marco: 7, urgente: false, canal: 'whatsapp', resultado: 'respondeu', observacao: 'x'.repeat(600) }).length).toBeLessThanOrEqual(560);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltosos.contatoDeFalta.test.js`
Expected: FAIL.

- [ ] **Step 3: Criar `src/lib/faltosos/contatoDeFalta.js`**

```js
// Monta o que o "Registrar contato" e o "Já voltou" da Meta do professor
// gravam. Puro: a gravação está em contatoDeFaltaWrites.js. `agora` é o
// serverTimestamp() de quem grava (as regras exigem a hora do servidor).
import { ABSENCE_CONTACT_TYPE, getInteractionSecurityFields } from '../leads.js';
import { CANAIS, RESULTADOS, canalTexto, resultadoTexto } from './metaProfessor.js';
import { TAREFA } from './planoImportacao.js';

const OBS_MAX = 500;

export function textoDoContato({ marco, urgente, canal, resultado, observacao }) {
  const obs = String(observacao || '').trim().slice(0, OBS_MAX);
  const base = `Contato de falta (${urgente ? 'urgente' : `${marco} dias`}), ${canalTexto(canal)}: ${resultadoTexto(resultado).toLowerCase()}.`;
  return obs ? `${base} ${obs}` : base;
}

function conferirPendente(estado) {
  if (estado?.tarefa?.status !== TAREFA.PENDENTE) throw new Error('A tarefa deste aluno não está pendente.');
}

const fechar = (estado, quem, agora, status, canal, resultado) => ({
  ...estado.tarefa, status, feitaEm: agora, feitaPor: quem?.id || null, feitaPorNome: quem?.name || null, canal, resultado,
});

export function montarContato({ lead, estado, quem, canal, resultado, observacao = '', agora }) {
  conferirPendente(estado);
  if (!CANAIS.some((c) => c.id === canal)) throw new Error('Canal do contato desconhecido.');
  if (!RESULTADOS.some((r) => r.id === resultado)) throw new Error('Resultado do contato desconhecido.');
  const marco = estado.tarefa.marco;
  const urgente = Boolean(estado.urgente || estado.tarefa.urgente);
  const interacao = {
    leadId: lead.id,
    leadName: lead.name || null,
    consultantName: quem?.name || null,
    ...getInteractionSecurityFields(lead, quem),
    actorId: quem?.id || null,
    actorAuthUid: quem?.authUid || null,
    createdAt: agora,
    type: ABSENCE_CONTACT_TYPE,
    canal, resultado, marco, urgente,
    inicioFalta: estado.inicioFalta || null,
    professorId: estado.professorId || null,
    text: textoDoContato({ marco, urgente, canal, resultado, observacao }),
  };
  const estadoPatch = { tarefa: fechar(estado, quem, agora, TAREFA.FEITA, canal, resultado) };
  if (resultado === 'quer_cancelar') {
    Object.assign(estadoPatch, { querCancelarEm: agora, querCancelarPorNome: quem?.name || null, querCancelarAluno: lead.name || null });
  }
  return { interacao, estadoPatch };
}

export function montarJaVoltou({ estado, quem, agora }) {
  conferirPendente(estado);
  return { tarefa: fechar(estado, quem, agora, TAREFA.VOLTOU, null, null) };
}
```

> Se o `faltosos.imports.test.js` reprovar este arquivo porque `leads.js` chega a pacote, mova `ABSENCE_CONTACT_TYPE` para `metaProfessor.js`, reexporte em `leads.js`, e copie o `getInteractionSecurityFields` (três linhas) para cá com um comentário apontando o original.

- [ ] **Step 4: Criar `src/lib/faltosos/contatoDeFaltaWrites.js`**

```js
// Grava o contato de falta e o "Já voltou" num lote só: a interação e a tarefa
// do aluno, ou nada. Não toca o lead (decisão P1 do plano do 2B).
//
// shortcut: a importação da Next Fit relê os estados do servidor e grava cada um
// inteiro, sem merge; um contato gravado entre a leitura dela e o fim do lote
// dela se perde no estado (a interação fica). Aceito por ser uma janela de
// segundos por semana; se acontecer, trocar a gravação da importação por
// transação.
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, FALTOSOS_PATH, INTERACTIONS_PATH } from '../firebase.js';
import { montarContato, montarJaVoltou } from './contatoDeFalta.js';

const col = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

export async function registrarContatoDeFalta(db, { lead, estado, quem, canal, resultado, observacao }) {
  const { interacao, estadoPatch } = montarContato({ lead, estado, quem, canal, resultado, observacao, agora: serverTimestamp() });
  const batch = writeBatch(db);
  batch.set(doc(col(db, INTERACTIONS_PATH)), interacao);
  batch.update(doc(col(db, FALTOSOS_PATH), estado.leadId), estadoPatch);
  await batch.commit();
}

export async function marcarJaVoltou(db, { estado, quem }) {
  const batch = writeBatch(db);
  batch.update(doc(col(db, FALTOSOS_PATH), estado.leadId), montarJaVoltou({ estado, quem, agora: serverTimestamp() }));
  await batch.commit();
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltosos.contatoDeFalta.test.js src/lib/__tests__/faltosos.imports.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/faltosos/contatoDeFalta.js src/lib/faltosos/contatoDeFaltaWrites.js src/lib/__tests__/faltosos.contatoDeFalta.test.js
git commit -m "feat: gravação do contato de falta e do Já voltou"
```

---

### Task 4: Regras do Firestore

**Files:**
- Modify: `firestore.rules:194-198` (`professorInteractionTypes`), `:523-530` (`stronix_faltosos`)
- Modify: `src/lib/professorWrites.js:67`
- Test: `src/lib/__tests__/faltososRules.test.js:83-88`, `src/lib/__tests__/professorRules.test.js`

- [ ] **Step 1: Atualizar o teste das regras dos faltosos**

No `faltososRules.test.js`, o teste das linhas 83-88 passa a separar create e update, com os ajudantes que o arquivo já tem:
```js
it('stronix_faltosos: o gestor cria; o gestor ou o professor do aluno atualiza', () => {
  expect(termosDe('stronix_faltosos', 'create')).toEqual(['inTenant(appId)', 'tenantActive(appId)', "hasModule(appId, 'faltosos')", 'isAdmin(appId)']);
  expect(termosDe('stronix_faltosos', 'update')).toEqual(['inTenant(appId)', 'tenantActive(appId)', "hasModule(appId, 'faltosos')", '(isAdmin(appId) || professorFaltosoOk(appId))']);
});

it('professorFaltosoOk: só o aluno dele, só a tarefa e o Quer cancelar, de pendente para feita ou voltou', () => {
  const f = corpoDaFuncao('professorFaltosoOk');
  expect(f).toContain('isProfessor(appId)');
  expect(f).toContain("userDoc(appId).data.get('professorId', null)");
  expect(f).toContain(".hasOnly(['tarefa', 'querCancelarEm', 'querCancelarPorNome', 'querCancelarAluno'])");
  expect(f).toContain("antes.tarefa.status == 'pendente'");
  expect(f).toContain("depois.tarefa.status in ['feita', 'voltou']");
  expect(f).toContain(".hasOnly(['status', 'feitaEm', 'feitaPor', 'feitaPorNome', 'canal', 'resultado'])");
  expect(f).toContain('depois.tarefa.feitaEm == request.time');
});
```
> `termosDe` e `corpoDaFuncao` são os nomes que este plano usa; se o arquivo já tiver ajudantes com outro nome, use os dele. `corpoDaFuncao(nome)` recorta `function nome(appId) {` até o `}` que fecha, contando chaves.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltososRules.test.js`
Expected: FAIL.

- [ ] **Step 3: Mudar as regras**

`professorInteractionTypes()`:
```
    function professorInteractionTypes() {
      return [
        'absence_contact',
        'note'
      ];
    }
```
e o comentário acima dela troca "O contato de falta (absence_contact) entra com a Meta do professor, no PR 3" por "O absence_contact é o Registrar contato da Meta do professor (src/lib/faltosos/contatoDeFalta.js)".

Logo antes do `match /artifacts/{appId}/public/data/stronix_faltosos/{leadId}`:
```
    // O professor fecha a tarefa dos alunos dele pela Meta (Registrar contato e
    // Já voltou, src/lib/faltosos/contatoDeFalta.js): só os campos da tarefa e
    // do Quer cancelar, só de pendente para feita ou voltou, com a hora do
    // servidor. O dono, o período, o marco e o urgente ficam como estão.
    function professorFaltosoOk(appId) {
      let antes = resource.data;
      let depois = request.resource.data;
      let mudou = depois.diff(antes).affectedKeys();
      return isProfessor(appId)
        && antes.get('professorId', null) != null
        && antes.get('professorId', null) == userDoc(appId).data.get('professorId', null)
        && mudou.hasOnly(['tarefa', 'querCancelarEm', 'querCancelarPorNome', 'querCancelarAluno'])
        && antes.tarefa.status == 'pendente'
        && depois.tarefa.status in ['feita', 'voltou']
        && depois.tarefa.diff(antes.tarefa).affectedKeys().hasOnly(['status', 'feitaEm', 'feitaPor', 'feitaPorNome', 'canal', 'resultado'])
        && depois.tarefa.feitaEm == request.time
        && (!mudou.hasAny(['querCancelarEm']) || depois.querCancelarEm == request.time);
    }
```
e a linha de update de `stronix_faltosos`:
```
      allow update: if inTenant(appId) && tenantActive(appId) && hasModule(appId, 'faltosos')
        && (isAdmin(appId) || professorFaltosoOk(appId));
```
O comentário do bloco troca "O professor marcar a tarefa como feita entra no PR 3" por "O professor fecha a tarefa dos alunos dele pela condição professorFaltosoOk, na mesma linha de update".

`src/lib/professorWrites.js:67`:
```js
import { ABSENCE_CONTACT_TYPE } from './leads.js';
export const PROFESSOR_INTERACTION_TYPES = sortedUnique([planProfileNote('-').type, 'note', ABSENCE_CONTACT_TYPE]);
```
(se o arquivo já importa de `./leads.js`, junte no import existente) e o comentário das linhas 12-14 diz que o `absence_contact` já está nas duas listas.

- [ ] **Step 4: Validar no Firebase**

Pelo MCP do Firebase: `firebase_validate_security_rules` com o `firestore.rules` inteiro. Expected: sem erro (o aviso antigo do `ownsLead` sem uso continua).

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltososRules.test.js src/lib/__tests__/professorRules.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules src/lib/professorWrites.js src/lib/__tests__/faltososRules.test.js
git commit -m "feat: regras do contato de falta pelo professor"
```

---

### Task 5: Leituras da tela (hooks)

**Files:**
- Create: `src/hooks/useFaltososDoProfessor.js`, `src/hooks/useAulasDeHojeDoProfessor.js`
- Test: `src/lib/__tests__/useFaltososDoProfessor.test.js` (jsdom)

- [ ] **Step 1: Escrever o teste do hook dos faltosos**

Siga o padrão de mock dos testes de hook que já existem (por exemplo o do `useNpsDados`). O teste cobre:
1. com `professorId: 'p1'` e `listenersActive: true`, o `onSnapshot` recebe a consulta com `where('professorId', '==', 'p1')`; depois do snapshot com o estado `l1`, `estados` é `[{ id: 'l1', ... }]`, `leadsById.get('l1').name` é o nome devolvido pelo `getDocs` mockado e `carregando` é `false`;
2. com `professorId: null`, nenhum `onSnapshot`;
3. com `listenersActive: false`, nenhum `onSnapshot`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/useFaltososDoProfessor.test.js`
Expected: FAIL.

- [ ] **Step 3: Criar os dois hooks**

`src/hooks/useFaltososDoProfessor.js`:
```js
// Os estados de falta de um professor e os leads deles, para a Meta do
// professor. Ao vivo, com o portão de ociosidade. A academia vai junto do que
// foi lido, para o "Acessar como" não mostrar a lista da academia anterior.
// shortcut: lê todo o histórico do professor (inclusive quem voltou) e filtra no
// navegador, sem índice composto; com muitos alunos, trocar por status ==
// 'faltando' mais professorId e criar o índice.
import { useEffect, useState } from 'react';
import { collection, documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { appId, FALTOSOS_PATH, LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { chunk } from '../lib/operacional/queries.js';

const col = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

export function useFaltososDoProfessor({ db, professorId, listenersActive = true }) {
  const [lido, setLido] = useState({ chave: null, estados: [], erro: false });
  const [leads, setLeads] = useState(() => new Map());
  const chave = professorId ? `${appId}:${professorId}` : null;

  useEffect(() => {
    if (!db || !professorId || !listenersActive) return undefined;
    return onSnapshot(
      query(col(db, FALTOSOS_PATH), where('professorId', '==', professorId)),
      (snap) => setLido({ chave, estados: snap.docs.map((d) => ({ id: d.id, ...d.data() })), erro: false }),
      () => setLido({ chave, estados: [], erro: true }),
    );
  }, [db, professorId, listenersActive, chave]);

  const estados = lido.chave === chave ? lido.estados : [];
  const faltam = estados.map((e) => e.id).filter((id) => !leads.has(id)).sort().join(',');

  useEffect(() => {
    if (!db || !faltam) return undefined;
    let vivo = true;
    Promise.all(chunk(faltam.split(','), 30).map((ids) => getDocs(query(col(db, LEADS_PATH), where(documentId(), 'in', ids)))))
      .then((snaps) => {
        if (!vivo) return;
        setLeads((antes) => {
          const nova = new Map(antes);
          snaps.forEach((s) => s.docs.forEach((d) => nova.set(d.id, normalizeLeadDoc(d))));
          return nova;
        });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [db, faltam]);

  return { estados, leadsById: leads, carregando: Boolean(chave) && lido.chave !== chave, erro: lido.chave === chave && lido.erro };
}
```

`src/hooks/useAulasDeHojeDoProfessor.js`:
```js
// As aulas experimentais de hoje de um professor, para a Agenda da Meta dele.
// Só leitura (decisão do Johnny, 27/11/2026). O filtro de tipo, professor e
// cancelada é no navegador: a consulta só pede o dia, no índice automático.
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { appId, AULAS_PATH } from '../lib/firebase.js';
import { isAulaRecord } from '../lib/aulas.js';

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function useAulasDeHojeDoProfessor({ db, professorId, now, listenersActive = true }) {
  const dia = inicioDoDia(now || new Date());
  const chave = professorId ? `${appId}:${professorId}:${dia}` : null;
  const [lido, setLido] = useState({ chave: null, aulas: [] });

  useEffect(() => {
    if (!db || !professorId || !listenersActive) return undefined;
    return onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', AULAS_PATH), where('scheduledFor', '>=', new Date(dia)), where('scheduledFor', '<=', new Date(dia + 86400000 - 1))),
      (snap) => setLido({
        chave,
        aulas: snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => isAulaRecord(a) && a.professorId === professorId && a.status !== 'cancelled'),
      }),
      () => setLido({ chave, aulas: [] }),
    );
  }, [db, professorId, listenersActive, dia, chave]);

  return lido.chave === chave ? lido.aulas : [];
}
```

> Confira como `scheduledFor` é gravado (`aulaRecordFields`, `src/lib/aulas.js:176`) e use o mesmo tipo na consulta, como o `useAulasInWindow` faz.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/useFaltososDoProfessor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFaltososDoProfessor.js src/hooks/useAulasDeHojeDoProfessor.js src/lib/__tests__/useFaltososDoProfessor.test.js
git commit -m "feat: leituras da Meta do professor"
```

---

### Task 6: A tela (`src/components/dailygoal/professor/`)

**Files:**
- Create: `ProfessorMetaScreen.jsx`, `AgoraFalta.jsx`, `FilaFaltosos.jsx`, `AgendaDoProfessor.jsx`, `RegistrarContatoDialog.jsx` em `src/components/dailygoal/professor/`
- Modify: `src/index.css` (efeito de troca e movimento reduzido)
- Test: `src/lib/__tests__/professorMeta.behavior.test.js` (jsdom)

Do mockup aprovado:
- Faixa do topo no cartão (`bg-card`): "Bom dia, Heloísa" (ou "Meta diária de Heloísa" quando o gestor vê), "Faltosos da semana, da importação de segunda, 23/11." (dia da semana e data do `ultimaImportacao.dataFaltantes`), "Ao vivo" (ou "Atualizado às HH:MM" com o portão fechado) e "1 de 5 contatos feitos" com a barra verde. Sem importação: "Sua lista de faltosos aparece aqui depois da primeira importação."
- `FocoBar` com uma aba só: `{ id: 'faltosos', label: 'Faltosos', pending: pendentes.length }`.
- Bloco Agora: cartão branco com `border-l-[6px]` âmbar, rosa no urgente, sem contorno azul; à esquerda, a foto no anel (âmbar, rosa no urgente) de 64 px; à direita, nome com "Abrir ficha", a frase "Não vem há 21 dias, desde 06/11." (mais "O contrato termina em 10/12." no urgente) e uma linha com o contato (`contactOf`) e o último contato de falta. Embaixo: WhatsApp, Registrar contato (principal) e Já voltou; à direita, "Pular por agora". O motivo (`motivoDe`) num selo no canto direito do topo.
- O Agora fica parado; Pular manda para o fim da fila, só nesta aba. Na troca por ação, o bloco ganha `meta-entra`, a linha de quem saiu ganha `meta-voltou`, e o foco vai para o bloco.
- Fila "Depois": botões com `Avatar` de 30 px, o nome e "Não vem há 37 dias" (no urgente, "..., contrato termina em 18/12" em rosa).
- Lateral (`xl:grid-cols-[minmax(0,1fr)_340px]`): `AgendaDoProfessor`, depois um `SideCard` com "Faltosos na semana" e "Feitos nesta semana".
- Gestor vendo: aviso âmbar "Você está vendo a Meta de Heloísa. O que você registrar aqui fica no seu nome."
- Professor sem ligação: só a faixa com "Seu acesso ainda não está ligado a um professor. Fale com o gestor."
- Nada pendente: "Tudo feito nesta semana" e "A próxima lista chega com a importação de segunda."

- [ ] **Step 1: Escrever os testes de comportamento**

```js
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfessorMetaScreen } from '../../components/dailygoal/professor/ProfessorMetaScreen.jsx';

const NOW = new Date('2026-11-27T14:40:00-03:00');
const est = (id, ultima, extra = {}) => ({
  id, leadId: id, status: 'faltando', professorId: 'p1', ultimaPresenca: ultima, inicioFalta: ultima, urgente: false,
  contratoTerminaEm: '2027-03-01',
  tarefa: { marco: 14, urgente: false, status: 'pendente', inicioFalta: ultima, criadaEm: '2026-11-23', importacaoId: 'f', feitaEm: null },
  ...extra,
});
const leads = new Map([
  ['a', { id: 'a', name: 'Marina Albuquerque', whatsapp: '51998124430' }],
  ['b', { id: 'b', name: 'Rodrigo Saldanha', whatsapp: '51993715568' }],
]);
const base = () => ({
  now: NOW, live: true, saudacao: 'Bom dia', nomeVisto: 'Heloísa', gestorVendo: false, professorLigado: true,
  ultimaImportacao: { dataFaltantes: '2026-11-23', importadoEm: new Date('2026-11-23T12:00:00Z') }, marcos: [7, 14, 30, 60],
  estados: [est('a', '2026-10-14', { urgente: true, contratoTerminaEm: '2026-12-10' }), est('b', '2026-10-21')],
  leadsById: leads, aulas: [], onRegistrar: vi.fn(), onJaVoltou: vi.fn(),
});
const montar = (p = {}) => { const props = { ...base(), ...p }; render(<MemoryRouter><ProfessorMetaScreen {...props} /></MemoryRouter>); return props; };

describe('Meta do professor', () => {
  it('o urgente abre no Agora, com a frase e o motivo', () => {
    montar();
    const agora = screen.getByRole('region', { name: 'Agora' });
    expect(within(agora).getByRole('heading', { name: 'Marina Albuquerque' })).toBeTruthy();
    expect(agora.textContent).toContain('Não vem há 44 dias, desde 14/10.');
    expect(agora.textContent).toContain('O contrato termina em 10/12.');
    expect(agora.textContent).toContain('Urgente: o contrato termina em 10/12');
  });

  it('a linha da fila traz o aluno para o Agora, com o efeito e o foco', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Rodrigo Saldanha/ }));
    const agora = screen.getByRole('region', { name: 'Agora' });
    expect(within(agora).getByRole('heading', { name: 'Rodrigo Saldanha' })).toBeTruthy();
    expect(agora.classList.contains('meta-entra')).toBe(true);
    expect(document.activeElement).toBe(agora);
    expect(screen.getByRole('button', { name: /Marina Albuquerque/ }).classList.contains('meta-voltou')).toBe(true);
  });

  it('Pular manda o Agora para o fim da fila', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Pular por agora' }));
    expect(within(screen.getByRole('region', { name: 'Agora' })).getByRole('heading', { name: 'Rodrigo Saldanha' })).toBeTruthy();
  });

  it('a linha da fila não repete o marco nem a situação', () => {
    montar();
    const linha = screen.getByRole('button', { name: /Rodrigo Saldanha/ });
    expect(linha.textContent).toContain('Não vem há 37 dias');
    expect(linha.textContent).not.toMatch(/Marco|Contato dos|pendente/i);
  });

  it('Já voltou chama a gravação com o estado do Agora', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Já voltou' }));
    expect(p.onJaVoltou).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('gestor vendo um professor vê o título e o aviso de autoria', () => {
    montar({ gestorVendo: true });
    expect(screen.getByText('Você está vendo a Meta de Heloísa. O que você registrar aqui fica no seu nome.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Meta diária de Heloísa');
  });

  it('professor sem ligação vê só o aviso', () => {
    montar({ professorLigado: false, estados: [] });
    expect(screen.getByText('Seu acesso ainda não está ligado a um professor. Fale com o gestor.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Agora' })).toBeNull();
  });

  it('a agenda é só leitura e diz quem marca', () => {
    montar({ aulas: [{ id: 'x', leadId: 'a', leadName: 'Ana Clara', modality: 'Funcional', status: 'attended', scheduledFor: new Date('2026-11-27T07:00:00-03:00') }] });
    const agenda = screen.getByRole('region', { name: 'Agenda de hoje' });
    expect(agenda.textContent).toContain('Compareceu');
    expect(agenda.textContent).toContain('Quem marca se o aluno veio é o consultor, na Meta dele.');
    expect(within(agenda).queryByRole('button')).toBeNull();
  });
});
```
e o teste do balão:
```js
import { RegistrarContatoDialog } from '../../components/dailygoal/professor/RegistrarContatoDialog.jsx';
it('o balão grava canal, resultado e observação', async () => {
  const onConfirm = vi.fn(() => Promise.resolve());
  render(<RegistrarContatoDialog lead={{ id: 'a', name: 'Marina' }} contexto="Urgente: o contrato termina em 10/12" onConfirm={onConfirm} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Ligação' }));
  fireEvent.click(screen.getByRole('radio', { name: /Quer cancelar/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar contato' }));
  expect(onConfirm).toHaveBeenCalledWith({ canal: 'ligacao', resultado: 'quer_cancelar', observacao: '' });
});
```
> Se o rádio do Radix não trocar com `click` no jsdom, use o mesmo gesto que os testes do `ContactOutcomeModal` usam com o `OutcomeCards` e o `ChoiceChips`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/professorMeta.behavior.test.js`
Expected: FAIL.

- [ ] **Step 3: Efeito de troca no `index.css`**

Antes do bloco "MOVIMENTO REDUZIDO":
```css
/* Troca do aluno no bloco Agora da Meta do professor (pedido do Johnny,
   27/11/2026): o novo entra e a borda pisca em azul; a linha de quem saiu
   acende na fila e apaga. */
@keyframes meta-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes meta-borda { from { border-left-color: var(--color-brand-600); } }
@keyframes meta-voltou { from { background-color: var(--color-brand-100); } }
.meta-entra > * { animation: meta-entra .22s ease-out both; }
.meta-entra { animation: meta-borda .6s ease-out; }
.meta-voltou { animation: meta-voltou 1.1s ease-out; }
```
e, na lista do bloco de movimento reduzido, `.meta-entra,`, `.meta-entra > *,` e `.meta-voltou,`.
> Use os nomes das variáveis de cor que o `@theme` do arquivo define.

- [ ] **Step 4: Criar os componentes**

`RegistrarContatoDialog.jsx`:
```jsx
import { useState } from 'react';
import { PopupShell, PopupButton, PopupLabel, ChoiceChips, NoteToggle } from '../popup/PopupShell.jsx';
import { OutcomeCards } from '../popup/OutcomeCards.jsx';
import { CANAIS, RESULTADOS } from '../../../lib/faltosos/metaProfessor.js';

export function RegistrarContatoDialog({ lead, contexto, onConfirm, onClose }) {
  const [canal, setCanal] = useState('whatsapp');
  const [resultado, setResultado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const confirmar = async () => {
    if (!resultado) return;
    setSalvando(true);
    setErro('');
    try {
      await onConfirm({ canal, resultado, observacao });
      onClose();
    } catch {
      setErro('Não deu para registrar. Tente de novo.');
      setSalvando(false);
    }
  };
  return (
    <PopupShell
      title="Registrar contato"
      lead={lead}
      context={contexto}
      busy={salvando}
      onClose={onClose}
      hint={erro || (resultado ? '' : 'Escolha o que aconteceu.')}
      actions={<PopupButton onClick={confirmar} disabled={!resultado || salvando}>Registrar contato</PopupButton>}
    >
      <PopupLabel id="contato-canal">Como foi o contato</PopupLabel>
      <ChoiceChips options={CANAIS} value={canal} onChange={setCanal} labelledBy="contato-canal" />
      <OutcomeCards question="O que aconteceu" options={RESULTADOS} value={resultado} onChange={setResultado} />
      <NoteToggle placeholder="Observação (opcional)" value={observacao} onChange={setObservacao} />
    </PopupShell>
  );
}
```
> O `OutcomeCards` monta 3 colunas acima de 2 opções; com 4 opções ele passa a 2 colunas (`options.length === 4`), sem mudar os casos de 2 e 3 que a Meta do consultor usa. Se ele exigir `Icon`, monte as opções no componente (`Check`, `MessageCircle`, `PhoneOff`, `X` do `lucide-react`), nunca no `metaProfessor.js`.

`AgendaDoProfessor.jsx`:
```jsx
import { LeadLink } from '../../nav/AppLink.jsx';
import { cn } from '../../../lib/utils.js';

const ms = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : Number(v));
const hora = (v) => new Date(ms(v)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const estadoDe = (a, now, proximaId) => {
  if (a.status === 'attended') return { id: 'veio', texto: 'Compareceu', ponto: 'bg-emerald-500', cor: 'text-emerald-700 dark:text-emerald-300' };
  if (a.status === 'no_show') return { id: 'faltou', texto: 'Não veio', ponto: 'bg-rose-500', cor: 'text-rose-700 dark:text-rose-300' };
  if (ms(a.scheduledFor) < now.getTime()) return { id: 'sem', texto: 'Sem desfecho', ponto: 'bg-amber-500', cor: 'text-amber-700 dark:text-amber-300' };
  if (a.id === proximaId) return { id: 'proxima', texto: 'Próxima', ponto: 'bg-brand-600', cor: 'text-brand-700 dark:text-brand-300' };
  return { id: 'depois', texto: '', ponto: 'bg-slate-300 dark:bg-slate-600', cor: '' };
};

export function AgendaDoProfessor({ aulas, now, nomeVisto, gestorVendo }) {
  const lista = [...(aulas || [])].sort((a, b) => ms(a.scheduledFor) - ms(b.scheduledFor));
  const proximaId = lista.find((a) => a.status === 'agendada' && ms(a.scheduledFor) >= now.getTime())?.id;
  return (
    <section aria-label="Agenda de hoje" className="rounded-2xl border border-border bg-card p-[18px]">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-[15px] font-bold">Agenda de hoje</h3>
        {lista.length > 0 && <span className="num text-[12.5px] text-muted-foreground">{lista.length === 1 ? '1 aula' : `${lista.length} aulas`}</span>}
      </div>
      <p className="mt-0.5 mb-2 text-[12.5px] text-muted-foreground">{gestorVendo ? `Aulas experimentais com ${nomeVisto}.` : 'Suas aulas experimentais.'}</p>
      {lista.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhuma aula experimental hoje.</p>
      ) : (
        <>
          <ol className="flex flex-col">
            {lista.map((a) => {
              const e = estadoDe(a, now, proximaId);
              return (
                <li key={a.id} className={cn('grid grid-cols-[44px_10px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border py-2 first:border-t-0', e.id === 'proxima' && '-mx-2.5 rounded-xl border-transparent bg-brand-50 px-2.5 dark:bg-brand-950/40')}>
                  <span className="num text-[13px] font-semibold">{hora(a.scheduledFor)}</span>
                  <i aria-hidden="true" className={cn('size-2 rounded-full', e.ponto)} />
                  <span className="flex min-w-0 flex-col">
                    <LeadLink leadId={a.leadId} className="truncate text-[13.5px] font-semibold hover:underline">{a.leadName || 'Aluno'}</LeadLink>
                    <span className="text-[12px] text-muted-foreground">{a.modality || 'Aula experimental'}</span>
                  </span>
                  {e.texto && <span className={cn('text-[12px] font-semibold whitespace-nowrap', e.cor)}>{e.texto}{e.id === 'proxima' && <span className="sr-only"> (próxima)</span>}</span>}
                </li>
              );
            })}
          </ol>
          <p className="mt-2.5 border-t border-border pt-2.5 text-[12px] text-muted-foreground">Quem marca se o aluno veio é o consultor, na Meta dele.</p>
        </>
      )}
    </section>
  );
}
```

`FilaFaltosos.jsx`:
```jsx
import { Avatar } from '../../ui/Avatar.jsx';
import { cn } from '../../../lib/utils.js';
import { fraseDe } from '../../../lib/faltosos/metaProfessor.js';

export function FilaFaltosos({ itens, leadsById, hojeDia, onPick, voltouId }) {
  if (!itens.length) return null;
  return (
    <section aria-label="Depois" className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-baseline justify-between px-[22px] pt-4 pb-2.5">
        <h3 className="font-display text-[15px] font-bold">Depois</h3>
        <span className="num text-[12.5px] text-muted-foreground">{itens.length}</span>
      </div>
      {itens.map((d) => {
        const lead = leadsById.get(d.id);
        const f = fraseDe(d, hojeDia);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onPick(d.id)}
            className={cn('grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 border-t border-border px-[22px] py-[11px] text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-inset', d.id === voltouId && 'meta-voltou')}
          >
            <Avatar name={lead?.name || ''} size={30} photoUrl={lead?.photoUrl} />
            <span className="min-w-0">
              <b className="block truncate text-[14px] font-semibold">{lead?.name || 'Aluno'}</b>
              <span className={cn('text-[12.5px]', d.urgente ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
                Não vem há <span className="num">{f.dias} dias</span>{f.termina && <>, contrato termina em <span className="num">{f.termina}</span></>}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
```

`AgoraFalta.jsx`:
```jsx
import { forwardRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { LeadLink } from '../../nav/AppLink.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { contactOf, whatsappHref } from '../../../lib/guardian.js';
import { fraseDe, motivoDe, canalTexto, resultadoTexto } from '../../../lib/faltosos/metaProfessor.js';

const BOTAO = 'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:border-brand-200 focus-visible:outline-none focus-visible:anel-foco';

export const AgoraFalta = forwardRef(function AgoraFalta({ estado, lead, hojeDia, now, entrando, ultimo, onRegistrar, onJaVoltou, onPular }, ref) {
  const f = fraseDe(estado, hojeDia);
  const contato = lead ? contactOf(lead, now) : null;
  const href = contato ? whatsappHref(contato.phone) : null;
  const textoContato = contato?.viaGuardian
    ? `${contato.name}${contato.relationship ? `, ${contato.relationship.toLowerCase()}` : ''} (responsável)`
    : contato?.phone;
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Agora"
      className={cn(
        'rounded-[18px] border border-border border-l-[6px] bg-card px-6 pt-5 pb-5 focus-visible:outline-none focus-visible:anel-foco',
        estado.urgente ? 'border-l-rose-500' : 'border-l-amber-500',
        entrando && 'meta-entra',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-brand-700 dark:text-brand-300">Agora</span>
        <span className={cn('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', estado.urgente ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{motivoDe(estado)}</span>
      </div>
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[18px]">
        <span className={cn('inline-grid rounded-full p-[3px]', estado.urgente ? 'bg-rose-500' : 'bg-amber-500')}>
          <Avatar name={lead?.name || ''} size={64} photoUrl={lead?.photoUrl} className="ring-[3px] ring-card" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-[26px] font-bold tracking-[-0.02em]">{lead?.name || 'Aluno'}</h2>
            <LeadLink leadId={estado.id} draggable={false} className="text-[13px] font-semibold text-brand-700 hover:underline dark:text-brand-300">Abrir ficha</LeadLink>
          </div>
          <p className="mt-1.5 text-[17px] text-slate-700 dark:text-slate-200">
            Não vem há <b className="num text-foreground">{f.dias} dias</b>, desde {f.desde}.
            {f.termina && <> O contrato termina em <b className="num text-rose-700 dark:text-rose-300">{f.termina}</b>.</>}
          </p>
          <p className="mt-3 mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
            {textoContato && <span>{contato.viaGuardian ? 'Falar com' : 'Contato'} <b className="num font-semibold text-foreground">{textoContato}</b></span>}
            <span>{ultimo ? `${canalTexto(ultimo.canal)} em ${ultimo.dia}, por ${ultimo.por}: ${resultadoTexto(ultimo.resultado).toLowerCase()}` : 'Nenhum contato de falta neste período'}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className={cn(BOTAO, 'text-emerald-700 dark:text-emerald-300')}><MessageCircle aria-hidden="true" className="size-4" />WhatsApp</a>}
          <button type="button" onClick={onRegistrar} className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background">Registrar contato</button>
          <button type="button" onClick={onJaVoltou} className={BOTAO}>Já voltou</button>
        </div>
        <button type="button" onClick={onPular} className="rounded text-[13px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:anel-foco">Pular por agora</button>
      </div>
    </section>
  );
});
```
> Confira se o `Avatar` aceita `className`; se não, ponha o `ring` num `span` em volta. Confira também como o `contactOf` devolve o parentesco (`relationship`) e ajuste o `textoContato`.

`ProfessorMetaScreen.jsx`:
```jsx
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FocoBar, SideCard, SideSection } from '../foco/FocoParts.jsx';
import { TabsContent } from '../../ui/tabs.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { cn } from '../../../lib/utils.js';
import { hojeEmBrasilia, ddmm, diaEmBrasilia } from '../../../lib/faltosos/dias.js';
import { pendentesDe, feitosDaSemana, gruposDaSemana, resultadoTexto, motivoDe } from '../../../lib/faltosos/metaProfessor.js';
import { AgoraFalta } from './AgoraFalta.jsx';
import { FilaFaltosos } from './FilaFaltosos.jsx';
import { AgendaDoProfessor } from './AgendaDoProfessor.jsx';
import { RegistrarContatoDialog } from './RegistrarContatoDialog.jsx';

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (dia) => DIA_SEMANA[new Date(`${dia}T12:00:00`).getDay()];
const COR_RESULTADO = { vai_voltar: 'text-emerald-700 dark:text-emerald-300', quer_cancelar: 'text-rose-700 dark:text-rose-300' };
const dataDe = (v) => (v?.toDate ? v.toDate() : v);

export function ProfessorMetaScreen({
  now, live, saudacao, nomeVisto, gestorVendo, professorLigado, ultimaImportacao, marcos,
  estados, leadsById, aulas, onRegistrar, onJaVoltou,
}) {
  const hojeDia = hojeEmBrasilia(now);
  const [pulados, setPulados] = useState([]);
  const [agoraId, setAgoraId] = useState(null);
  const [troca, setTroca] = useState(null);
  const [registrando, setRegistrando] = useState(null);
  const agoraRef = useRef(null);
  const nomeDe = (id) => leadsById.get(id)?.name || '';

  const pendentes = useMemo(() => {
    const ordem = pendentesDe(estados, hojeDia, (id) => leadsById.get(id)?.name || '');
    return [...ordem.filter((d) => !pulados.includes(d.id)), ...ordem.filter((d) => pulados.includes(d.id))];
  }, [estados, hojeDia, leadsById, pulados]);
  const feitos = useMemo(() => feitosDaSemana(estados, ultimaImportacao?.importadoEm), [estados, ultimaImportacao]);
  const agora = pendentes.find((d) => d.id === agoraId) || pendentes[0] || null;
  const fila = pendentes.filter((d) => d !== agora);

  useLayoutEffect(() => { if (troca) agoraRef.current?.focus(); }, [troca]);

  const trocar = (id, pulando = false) => {
    if (!agora || !id) return;
    if (pulando) setPulados((p) => [...p.filter((x) => x !== agora.id), agora.id]);
    setTroca((t) => ({ saiu: agora.id, n: (t?.n || 0) + 1 }));
    setAgoraId(id);
  };

  const total = pendentes.length + feitos.length;
  const titulo = gestorVendo ? `Meta diária de ${nomeVisto}` : `${saudacao}, ${nomeVisto}`;
  const linhaImport = ultimaImportacao?.dataFaltantes
    ? `Faltosos da semana, da importação de ${diaDaSemana(ultimaImportacao.dataFaltantes)}, ${ddmm(ultimaImportacao.dataFaltantes)}.`
    : 'Sua lista de faltosos aparece aqui depois da primeira importação.';
  const ultimoContato = (d) => (d.tarefa?.canal
    ? { canal: d.tarefa.canal, resultado: d.tarefa.resultado, por: d.tarefa.feitaPorNome, dia: ddmm(diaEmBrasilia(dataDe(d.tarefa.feitaEm))) }
    : null);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-card px-6 py-[18px]">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.02em]">{titulo}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {professorLigado ? linhaImport : 'Seu acesso ainda não está ligado a um professor. Fale com o gestor.'}
            {professorLigado && (live
              ? <span className="ml-2 inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><i aria-hidden="true" className="size-[7px] rounded-full bg-emerald-500" />Ao vivo</span>
              : <span className="ml-2">Atualizado às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>)}
          </p>
        </div>
        {professorLigado && total > 0 && (
          <div className="grid min-w-[200px] grid-cols-[auto_auto] items-baseline gap-x-2.5 gap-y-0.5">
            <b className="num font-display text-[22px] font-bold">{feitos.length} de {total}</b>
            <span className="text-[13px] text-muted-foreground">contatos feitos</span>
            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-emerald-500" style={{ width: `${(feitos.length / total) * 100}%` }} /></span>
          </div>
        )}
      </header>
      {gestorVendo && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Você está vendo a Meta de {nomeVisto}. O que você registrar aqui fica no seu nome.</p>}
      {professorLigado && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <FocoBar tabs={[{ id: 'faltosos', label: 'Faltosos', pending: pendentes.length }]} value="faltosos" onChange={() => {}}>
            <TabsContent value="faltosos" tabIndex={-1} className="mt-4">
              {agora ? (
                <AgoraFalta
                  key={troca?.n || 0}
                  ref={agoraRef}
                  estado={agora}
                  lead={leadsById.get(agora.id)}
                  hojeDia={hojeDia}
                  now={now}
                  entrando={Boolean(troca)}
                  ultimo={ultimoContato(agora)}
                  onRegistrar={() => setRegistrando(agora)}
                  onJaVoltou={() => onJaVoltou(agora)}
                  onPular={() => trocar(fila[0]?.id, true)}
                />
              ) : (
                <section className="rounded-[18px] bg-card px-6 py-8">
                  <h2 className="font-display text-[20px] font-bold">Tudo feito nesta semana</h2>
                  <p className="text-[13px] text-muted-foreground">A próxima lista chega com a importação de segunda.</p>
                </section>
              )}
              <FilaFaltosos itens={fila} leadsById={leadsById} hojeDia={hojeDia} onPick={(id) => trocar(id)} voltouId={troca?.saiu} />
            </TabsContent>
          </FocoBar>
          <aside aria-label="Painel do dia" className="flex flex-col gap-4">
            <AgendaDoProfessor aulas={aulas} now={now} nomeVisto={nomeVisto} gestorVendo={gestorVendo} />
            <SideCard>
              <SideSection
                title="Faltosos na semana"
                items={gruposDaSemana(pendentes, marcos)}
                empty="Ninguém."
                renderItem={(g) => (
                  <div key={g.id} className="flex justify-between text-[13px]">
                    <span className={cn(g.id === 'urgentes' && g.total > 0 && 'font-semibold text-rose-700 dark:text-rose-300')}>{g.nome}</span>
                    <b className="num">{g.total}</b>
                  </div>
                )}
              />
              <SideSection
                title="Feitos nesta semana"
                count={feitos.length}
                items={feitos}
                empty="Nenhum ainda."
                renderItem={(d) => (
                  <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]">
                    <Avatar name={nomeDe(d.id)} size={26} photoUrl={leadsById.get(d.id)?.photoUrl} />
                    <span className="truncate">{nomeDe(d.id)}</span>
                    <span className={cn('text-[12px] font-semibold', COR_RESULTADO[d.tarefa.resultado] || 'text-muted-foreground')}>{d.tarefa.status === 'voltou' ? 'Já voltou' : resultadoTexto(d.tarefa.resultado)}</span>
                  </div>
                )}
              />
            </SideCard>
          </aside>
        </div>
      )}
      {registrando && (
        <RegistrarContatoDialog
          lead={leadsById.get(registrando.id) || { id: registrando.id, name: '' }}
          contexto={motivoDe(registrando)}
          onConfirm={(r) => onRegistrar(registrando, r)}
          onClose={() => setRegistrando(null)}
        />
      )}
    </div>
  );
}
```
> O `key={troca?.n}` remonta o bloco em cada troca, para a animação rodar de novo, e o `useLayoutEffect` leva o foco. "Ver todas" do `SideSection` aparece com muitos itens, como na Meta do consultor.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/professorMeta.behavior.test.js src/lib/__tests__/movimentoReduzido.test.js src/lib/__tests__/leadLinkSweep.test.js src/lib/__tests__/anelDeFoco.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/dailygoal/professor src/index.css src/lib/__tests__/professorMeta.behavior.test.js
git commit -m "feat: tela da Meta diária do professor"
```

---

### Task 7: Rota, seletor do gestor e o fim do aviso provisório

**Files:**
- Modify: `src/lib/screenParams.js` (`dailyGoal`)
- Create: `src/views/MetaDiariaRoute.jsx`, `src/components/dailygoal/professor/SeletorDeMeta.jsx`
- Modify: `src/App.jsx:115` e `:2006-2008`
- Delete: `src/views/ProfessorGoalPlaceholder.jsx`, `src/lib/__tests__/professorGoalPlaceholder.test.js`
- Modify: `src/lib/__tests__/professorShell.test.js:129-131`
- Test: `src/lib/__tests__/screenParams.test.js`, `src/lib/__tests__/metaDiariaRoute.behavior.test.js` (jsdom)

- [ ] **Step 1: Testes**

`screenParams.test.js`, com as funções de leitura e montagem que o arquivo testa hoje:
```js
describe('dailyGoal: prof', () => {
  const ctx = { podeVerProf: true, professoresAtivos: [{ id: 'p1' }, { id: 'p2' }] };
  it('lê só professor ativo, e só para quem pode ver', () => {
    // ?prof=p1 → 'p1'; ?prof=xx → null; podeVerProf false → null
  });
  it('a Meta do próprio gestor não se escreve', () => {
    // { cat: 'all', prof: null } → ''; { cat: 'all', prof: 'p2' } → '?prof=p2'
  });
});
```
`metaDiariaRoute.behavior.test.js`, com o `MetaDiariaRoute` num `MemoryRouter` e o `ProfessorMetaScreen` e o `DailyGoalView` trocados por dublês (`vi.mock`) que escrevem as props recebidas:
1. professor: o `ProfessorMetaScreen` com `gestorVendo: false` e sem seletor;
2. gestor com o módulo e `?prof=p1`: o `ProfessorMetaScreen` com `gestorVendo: true` e o seletor com o professor escolhido;
3. consultor com `?prof=p1`: o `DailyGoalView`, sem seletor;
4. gestor sem `?prof`: o `DailyGoalView` com o seletor em "Minha meta".

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/metaDiariaRoute.behavior.test.js`
Expected: FAIL.

- [ ] **Step 3: O parâmetro `prof` da Meta**

Em `src/lib/screenParams.js`, perto do `cat`:
```js
// Professor visto pelo gestor na Meta diária (Meta do professor, 2B). Ausente é
// a Meta do próprio gestor e nunca se escreve.
const ativoNaMeta = (ctx, id) => Boolean(ctx.podeVerProf && id && (ctx.professoresAtivos || []).some((p) => p?.id === id));
const profMeta = param('prof', (raw, ctx) => (ativoNaMeta(ctx, raw) ? raw : null), (v, ctx) => (ativoNaMeta(ctx, v) ? v : null));
```
e `dailyGoal: { cat, prof: profMeta },`.

- [ ] **Step 4: Seletor e rota**

`SeletorDeMeta.jsx`:
```jsx
export function SeletorDeMeta({ professores, valor, onEscolher }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      Ver a Meta de
      <select
        value={valor || ''}
        onChange={(e) => onEscolher(e.target.value || null)}
        className="h-9 rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-semibold text-brand-700 focus-visible:outline-none focus-visible:anel-foco dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
      >
        <option value="">Minha meta</option>
        {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
  );
}
```

`src/views/MetaDiariaRoute.jsx`:
```jsx
// Decide qual Meta diária aparece: a do consultor (DailyGoalView), a do
// professor logado, ou a de um professor escolhido pelo gestor no seletor.
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useScreenParams } from '../hooks/useScreenParams.js';
import { useGeneralConfig } from '../contexts/GeneralConfigContext.jsx';
import { useMinuteClock, useFrozenWhileIdle } from '../hooks/useMinuteClock.js';
import { useFaltososDoProfessor } from '../hooks/useFaltososDoProfessor.js';
import { useAulasDeHojeDoProfessor } from '../hooks/useAulasDeHojeDoProfessor.js';
import { registrarContatoDeFalta, marcarJaVoltou } from '../lib/faltosos/contatoDeFaltaWrites.js';
import { configDasTelas } from '../lib/faltosos/configFaltosos.js';
import { isGestor, isProfessor } from '../lib/acesso.js';
import { hasModule, MODULES } from '../lib/modules.js';
import { firstName } from '../lib/guardian.js';
import { DailyGoalView } from './DailyGoalView.jsx';
import { ProfessorMetaScreen } from '../components/dailygoal/professor/ProfessorMetaScreen.jsx';
import { SeletorDeMeta } from '../components/dailygoal/professor/SeletorDeMeta.jsx';

const saudacaoDe = (d) => (d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

function MetaDoProfessor({ db, appUser, professorId, nomeVisto, gestorVendo, listenersActive, topo = null }) {
  const { faltosos } = useGeneralConfig();
  const config = configDasTelas(faltosos);
  const liveNow = useMinuteClock();
  const now = useFrozenWhileIdle(liveNow, listenersActive);
  const { estados, leadsById } = useFaltososDoProfessor({ db, professorId, listenersActive });
  const aulas = useAulasDeHojeDoProfessor({ db, professorId, now, listenersActive });
  const onRegistrar = async (estado, r) => {
    await registrarContatoDeFalta(db, { lead: leadsById.get(estado.id) || { id: estado.id }, estado, quem: appUser, ...r });
    toast.success('Contato registrado.');
  };
  const onJaVoltou = async (estado) => {
    try {
      await marcarJaVoltou(db, { estado, quem: appUser });
      toast.success('Marcado como de volta.');
    } catch {
      toast.error('Não deu para marcar. Tente de novo.');
    }
  };
  return (
    <>
      {topo}
      <ProfessorMetaScreen
        now={now}
        live={listenersActive}
        saudacao={saudacaoDe(now)}
        nomeVisto={nomeVisto}
        gestorVendo={gestorVendo}
        professorLigado={Boolean(professorId)}
        ultimaImportacao={config.ultimaImportacao}
        marcos={config.marcos}
        estados={estados}
        leadsById={leadsById}
        aulas={aulas}
        onRegistrar={onRegistrar}
        onJaVoltou={onJaVoltou}
      />
    </>
  );
}

export function MetaDiariaRoute({ db, appUser, listenersActive, dailyGoalProps }) {
  const { professores = [] } = useGeneralConfig();
  const podeVerProf = hasModule(appUser?.tenantModules, MODULES.FALTOSOS) && isGestor(appUser);
  const ativos = useMemo(
    () => professores.filter((p) => p?.ativo !== false)
      .map((p) => ({ id: p.id, nome: p.nome || p.name || '' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [professores],
  );
  const ctx = useMemo(() => ({ podeVerProf, professoresAtivos: ativos }), [podeVerProf, ativos]);
  const [{ prof }, setParams] = useScreenParams('dailyGoal', ctx);

  if (isProfessor(appUser)) {
    const meu = typeof appUser?.professorId === 'string' && appUser.professorId.trim() ? appUser.professorId : null;
    return <MetaDoProfessor db={db} appUser={appUser} professorId={meu} nomeVisto={firstName(appUser?.name) || 'professor'} gestorVendo={false} listenersActive={listenersActive} />;
  }
  const seletor = podeVerProf && ativos.length > 0
    ? <div className="mb-3 flex justify-end"><SeletorDeMeta professores={ativos} valor={prof} onEscolher={(id) => setParams({ prof: id })} /></div>
    : null;
  if (prof) {
    const nome = ativos.find((p) => p.id === prof)?.nome || '';
    return <MetaDoProfessor db={db} appUser={appUser} professorId={prof} nomeVisto={firstName(nome) || nome} gestorVendo listenersActive={listenersActive} topo={seletor} />;
  }
  return <>{seletor}<DailyGoalView {...dailyGoalProps} /></>;
}
```
> Confira: o campo do nome em `stronix_professores` (`nome` ou `name`), o caminho do `GeneralConfigContext`, a biblioteca de toast do app e a assinatura de `useScreenParams` (o `setParams({ prof })` mantém o `cat`).

- [ ] **Step 5: Ligar no `App.jsx`**

Trocar o import da linha 115 por `import { MetaDiariaRoute } from './views/MetaDiariaRoute.jsx';` e as linhas 2006-2008 por:
```jsx
{activeTab === 'dailyGoal' && (
  <MetaDiariaRoute
    db={db}
    appUser={appUser}
    listenersActive={listenersActive}
    dailyGoalProps={{ leads: goalLeads, agendaLeads: dayAgendaLeads, interactions, appUser, statuses, db, tags, lossReasons, usersList, funnels, listenersActive }}
  />
)}
```
Apagar `src/views/ProfessorGoalPlaceholder.jsx` e `src/lib/__tests__/professorGoalPlaceholder.test.js`. No `professorShell.test.js`, a expectativa das linhas 129-131 passa a:
```js
expect(app).toMatch(/activeTab === 'dailyGoal' && \(\s*<MetaDiariaRoute/);
expect(app).not.toMatch(/ProfessorGoalPlaceholder/);
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/screenParams.test.js src/lib/__tests__/metaDiariaRoute.behavior.test.js src/lib/__tests__/professorShell.test.js src/lib/__tests__/filtrosNoEndereco.sweep.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/screenParams.js src/views/MetaDiariaRoute.jsx src/components/dailygoal/professor/SeletorDeMeta.jsx src/App.jsx src/lib/__tests__/screenParams.test.js src/lib/__tests__/metaDiariaRoute.behavior.test.js src/lib/__tests__/professorShell.test.js
git rm src/views/ProfessorGoalPlaceholder.jsx src/lib/__tests__/professorGoalPlaceholder.test.js
git commit -m "feat: Meta do professor no lugar do aviso, com o seletor do gestor"
```

---

### Task 8: "Querem cancelar" no sino do gestor

**Files:**
- Create: `src/hooks/useQuerCancelar.js`
- Modify: `src/lib/notifications.js` (`buildNotificationFeed`), `src/components/layout/NotificationBell.jsx`, `src/App.jsx:287` e `:1902-1914`
- Test: `src/lib/__tests__/notifications.test.js`

- [ ] **Step 1: Teste do feed**

```js
it('quer cancelar: só para o gestor, com o não lido pelo carimbo de sempre', () => {
  const at = new Date('2026-11-26T15:00:00Z');
  const cancelamentos = [{ id: 'l1', querCancelarEm: { toDate: () => at }, querCancelarAluno: 'Marina', querCancelarPorNome: 'Heloísa' }];
  const comum = { announcements: [], seenIds: [], leads: [], handoffLeads: [], cancelamentos, lastSeenReferralsAt: 0, now: new Date('2026-11-27T12:00:00Z') };
  const gestor = buildNotificationFeed({ ...comum, appUser: { role: 'admin' } });
  expect(gestor.cancelamentos).toEqual([{ id: 'l1', name: 'Marina', por: 'Heloísa', at, unread: true }]);
  expect(gestor.unreadCount).toBe(1);
  expect(buildNotificationFeed({ ...comum, appUser: { role: 'consultant' } }).cancelamentos).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/notifications.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`buildNotificationFeed` recebe `cancelamentos: cancelamentosIn = []` e, antes do `unreadCount`:
```js
  // Aluno que disse "quer cancelar" no contato de falta (Meta do professor).
  // Só o gestor recebe; o "já li" é o mesmo carimbo das indicações.
  const cancelamentos = isAdmin ? (cancelamentosIn || [])
    .map((c) => ({ id: c.id, name: c.querCancelarAluno || 'Aluno', por: c.querCancelarPorNome || '', at: c.querCancelarEm?.toDate?.() || null }))
    .filter((c) => c.at && now - c.at <= windowDays * 86400000)
    .sort((a, b) => b.at - a.at)
    .map((c) => ({ ...c, unread: c.at.getTime() > lastSeenReferralsAt })) : [];
```
soma `cancelamentos.filter((c) => c.unread).length` ao `unreadCount` e devolve `cancelamentos` no objeto.

`src/hooks/useQuerCancelar.js`:
```js
// Os alunos que disseram "quer cancelar" nos últimos 30 dias, para o sino do
// gestor. Uma leitura na abertura, como o useHandoffs.
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { appId, FALTOSOS_PATH } from '../lib/firebase.js';

export function useQuerCancelar({ db, enabled }) {
  const [itens, setItens] = useState([]);
  useEffect(() => {
    if (!db || !enabled) return undefined;
    let vivo = true;
    const desde = new Date(Date.now() - 30 * 86400000);
    getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', FALTOSOS_PATH), where('querCancelarEm', '>=', desde)))
      .then((s) => { if (vivo) setItens(s.docs.map((d) => ({ id: d.id, ...d.data() }))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [db, enabled]);
  return enabled ? itens : [];
}
```

`App.jsx`, perto da linha 287:
```js
const cancelamentos = useQuerCancelar({ db, enabled: !!appUser && !appUser.superAdminOnly && isGestor(appUser) && hasModule(appUser.tenantModules, MODULES.FALTOSOS) });
```
e `cancelamentos={cancelamentos}` no `<NotificationBell>`.

`NotificationBell.jsx`: repassa `cancelamentos` ao `buildNotificationFeed`, conta `feed.cancelamentos.length` no `vazio` e desenha o grupo antes das indicações, com as props das linhas vizinhas:
```jsx
{feed.cancelamentos.length > 0 && (
  <>
    <GroupLabel>Querem cancelar</GroupLabel>
    {feed.cancelamentos.map((c) => (
      <NotificationRow key={`qc-${c.id}`} icon={UserX} tone="rose" title={c.name} subtitle={c.por ? `Disse ao professor ${c.por} que quer cancelar.` : 'Disse que quer cancelar.'} time={c.at} unread={c.unread} leadId={c.id} onNavigate={() => setOpen(false)} />
    ))}
  </>
)}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/notifications.test.js src/lib/__tests__/notificationsProfessor.test.js src/lib/__tests__/professorShell.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useQuerCancelar.js src/lib/notifications.js src/components/layout/NotificationBell.jsx src/App.jsx src/lib/__tests__/notifications.test.js
git commit -m "feat: sino do gestor avisa quem quer cancelar"
```

---

### Task 9: Sem professor e Não achados no bloco Faltosos

**Files:**
- Create: `src/hooks/useRegistroDaImportacao.js`
- Modify: `src/views/settings/FaltososPanel.jsx`
- Test: `src/lib/__tests__/faltososPanel.test.js`

- [ ] **Step 1: Teste**

No `faltososPanel.test.js`, com o mock que o arquivo usa, um caso com um estado `faltando` sem `professorId` (o lead dele com o nome "Jéssica Lemos") e um registro com `naoLigados: [{ nome: 'JOAO PEDRO S. LIMA', telefone: '51996345519', relatorio: 'faltantes' }]`:
```js
expect(await screen.findByText('Sem professor')).toBeTruthy();
expect(await screen.findByText('Jéssica Lemos')).toBeTruthy();
expect(screen.getByText('Não achados')).toBeTruthy();
expect(screen.getByText('JOAO PEDRO S. LIMA')).toBeTruthy();
```
e um caso sem nenhum dos dois, em que as duas seções não aparecem.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/faltososPanel.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`src/hooks/useRegistroDaImportacao.js`:
```js
// O registro da última importação (só o gestor lê): os nomes que ela não ligou.
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { appId, IMPORTACOES_NEXTFIT_PATH } from '../lib/firebase.js';

export function useRegistroDaImportacao({ db, id }) {
  const [lido, setLido] = useState({ id: null, registro: null });
  useEffect(() => {
    if (!db || !id) return undefined;
    let vivo = true;
    getDoc(doc(db, 'artifacts', appId, 'public', 'data', IMPORTACOES_NEXTFIT_PATH, id))
      .then((s) => { if (vivo) setLido({ id, registro: s.exists() ? s.data() : null }); })
      .catch(() => { if (vivo) setLido({ id, registro: null }); });
    return () => { vivo = false; };
  }, [db, id]);
  return lido.id === id ? lido.registro : null;
}
```
No `FaltososPanel.jsx`, depois da seção da última importação:
- `const registro = useRegistroDaImportacao({ db, id: ultima?.id });`
- os sem professor: um `getDocs` de `stronix_faltosos` com `where('professorId', '==', null)`, na abertura do bloco, filtrando `status === 'faltando'` no navegador, e os nomes lidos dos leads por id em lotes de 30 (com `chunk`, como no `useFaltososDoProfessor`);
- seção "Sem professor" (o número e um nome por linha, com a nota "Ligue o professor da Next Fit em Professores da Next Fit, logo abaixo.");
- seção "Não achados" (o número e `registro.naoLigados`, um por linha: o nome, o telefone quando houver e "no Faltantes" ou "no Presenças", com a nota "A importação não achou um cliente com esse nome ou telefone. Ligue na próxima.").
Sem itens, a seção não aparece. Use as peças visuais que o bloco já usa (`PanelNote` e afins).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/faltososPanel.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRegistroDaImportacao.js src/views/settings/FaltososPanel.jsx src/lib/__tests__/faltososPanel.test.js
git commit -m "feat: sem professor e não achados no bloco Faltosos"
```

---

### Task 10: CLAUDE.md

- [ ] **Step 1: Seção nova**

Em `CLAUDE.md`, depois de "Faltosos e importação da Next Fit", a seção "Meta diária do professor": o que a tela mostra, o Agora parado e o efeito de troca, a agenda só para ver (e por quê), o `MetaDiariaRoute` e o `prof` do gestor, a gravação (lote sem tocar o lead, `absence_contact`, os campos da tarefa), o `professorFaltosoOk`, o "Quer cancelar" no sino, o risco da corrida com a importação e o fim do `ProfessorGoalPlaceholder`. Nas "travas do professor", a frase sobre o `absence_contact` passa ao estado atual. Em "Professor → As telas", a Meta diária do professor deixa de ser o `ProfessorGoalPlaceholder`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: Meta diária do professor no CLAUDE.md"
```

---

### Task 11: Verificação completa

- [ ] **Step 1:** `npm run lint && npm test && npm run verificar:sentry && npm run build`. Expected: tudo verde e mais testes que na linha de base.
- [ ] **Step 2:** Abrir a tela no harness local com Firestore falso, como professor e como gestor com `?prof=`, no claro e no escuro, a 1360 px e a 375 px: o Agora com a foto e o efeito, a fila, a agenda, o balão, o seletor e o aviso de autoria.
- [ ] **Step 3:** `git diff origin/main --stat` e conferir que só mudou o que está no mapa de arquivos.

---

### Task 12: PR, regras e o teste de verdade

- [ ] **Step 1:** Push da branch e PR com o resumo, o mapa de arquivos, os riscos e o roteiro de teste no Preview.
- [ ] **Step 2:** Code review, sugerindo de 3 a 8 ciclos; regras e gravação no Firestore na capacidade maior.
- [ ] **Step 3: Regras.** Ler a regra no ar (`firebase_get_security_rules`), aplicar só o diff deste PR (as duas funções e a linha de update de `stronix_faltosos`), validar e mostrar o diff ao Johnny. Publicar só com o OK dele, antes do merge, e anotar na nota das sessões.
- [ ] **Step 4: Preview, na academia de teste:** um professor de teste com alunos faltosos (de uma importação de teste) registra um contato de cada resultado e marca um "Já voltou"; conferir a linha do tempo da ficha ("Contato de falta"), o "Feitos nesta semana", o sino do gestor com o "Quer cancelar", o seletor do gestor e o aviso de autoria. Um consultor não vê o seletor, e a Meta do consultor continua igual.
- [ ] **Step 5:** Merge só com a aprovação do Johnny.

---

## Fora deste plano

- O relatório da lista completa de faltosos, no grupo Clientes dos Relatórios.
- Treinos a vencer e Treinos vencidos na barra "Foco em".
- O efeito de troca na Meta do consultor (cartão de tarefa à parte).
- A ficha (2C): o selo "Sem vir há X dias" e a aba Presenças.
- Trocar a gravação da importação por transação (risco 1).
