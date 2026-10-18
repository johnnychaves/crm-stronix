// O ContractModal avisa os chamadores quando o onDone chega depois de o modal já ter sido
// fechado pelo X (gravação pendente sem internet, modal reaberto): `onDone({ stale })`.
// Cada chamador só fecha o modal quando `stale` é falso. O Kanban faz mais que fechar:
// recarrega o quadro mesmo com `stale`, porque a gravação valeu, e esse resto fica FORA do `if`
// e tem de ser alcançável: nem `return`, nem `throw`, nem `else` ligados ao `if (!stale)`.
// As três telas importam o Firebase e são grandes demais para montar num teste, como as
// outras varreduras de view deste projeto: esta lê o código e reprova quem mudar o desenho.
//
// O `onDone` tem de ser escrito EM LINHA no `<ContractModal>` (`onDone={({ stale }) => {...}}`),
// de propósito: a varredura confere o corpo no ponto de uso. Um `onDone={handlerNomeado}` leva o
// corpo para outro lugar do arquivo, e aí a varredura não saberia mais onde está o fechamento
// nem se ele ficou dentro do `if (!stale)`. Por isso essa forma é recusada.
//
// A conferência é de texto, então o fechamento só conta como chamada de verdade: o texto das
// strings é tirado antes de procurar (um `console.debug('setX(false)')` não fecha nada).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
// Tira os comentários do arquivo inteiro (inclusive `{/* ... */}` de JSX), sem tocar em `://` de URL.
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
// Esvazia as strings ('x', "x" e `x`): o que está escrito dentro delas não é código.
const semStrings = (t) => t.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
const compacta = (t) => t.replace(/\s+/g, ' ').trim();

// O `{ ... }` que começa em `ini`, até a chave que o fecha. As chaves dentro de string não contam.
function blocoEquilibrado(t, ini) {
  let nivel = 0;
  for (let i = ini; i < t.length; i += 1) {
    const c = t[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i += 1; i < t.length && t[i] !== c; i += 1) if (t[i] === '\\') i += 1;
    } else if (c === '{') nivel += 1;
    else if (c === '}') { nivel -= 1; if (!nivel) return { conteudo: t.slice(ini + 1, i), fim: i }; }
  }
  throw new Error('chaves sem fechar');
}

// O corpo do `onDone={...}` do único <ContractModal> do arquivo, sem comentários e compactado:
// `comStrings` para conferir texto escrito, `limpo` (sem o texto das strings) para a estrutura.
function corpoDoOnDone(fonte) {
  const sem = semComentarios(fonte);
  const usos = [...sem.matchAll(/<ContractModal[\s>]/g)];
  expect(usos.length).toBe(1);
  const ini = sem.indexOf('onDone={', usos[0].index) + 'onDone='.length;
  const comStrings = compacta(blocoEquilibrado(sem, ini).conteudo);
  return { comStrings, limpo: semStrings(comStrings) };
}

// Tira o `if (!stale)` do corpo e devolve o que ele guardava (com ou sem chaves, com um ou mais
// comandos) e o resto. `return`, `throw` e `else` ligados a ele são recusados: o resto do corpo
// (as recargas do Kanban) tem de ser alcançado quando `stale` é verdadeiro e quando é falso.
function separaOGuarda(corpo) {
  const marca = 'if (!stale)';
  const a = corpo.indexOf(marca);
  expect(a).toBeGreaterThanOrEqual(0);
  let depois = a + marca.length;
  while (corpo[depois] === ' ') depois += 1;
  let guardado;
  let fim;
  if (corpo[depois] === '{') {
    const b = blocoEquilibrado(corpo, depois);
    guardado = compacta(b.conteudo);
    fim = b.fim + 1;
  } else {
    fim = corpo.indexOf(';', depois) + 1;
    guardado = compacta(corpo.slice(depois, fim));
  }
  expect(guardado).not.toMatch(/\b(return|throw)\b/);
  expect(corpo.slice(fim).trimStart()).not.toMatch(/^else\b/);
  return { guardado, resto: compacta(corpo.slice(0, a) + corpo.slice(fim)) };
}

// O corpo começa por `({ stale })` ou `({ stale } = {})`, o fechamento está dentro do `if (!stale)`
// como chamada de verdade e não aparece em lugar nenhum fora dele, e `stale` só existe na
// assinatura e nesse `if`. Com `soFechamento` (o Kanban), o `if` guarda só o fechamento: tirando-o,
// sobram só `;`, espaços e chaves. O resto não tem `return` nem `throw`.
function exigeFecharSoSeNaoAtrasado({ comStrings, limpo }, fechar, { soFechamento = false } = {}) {
  expect(/^\(\s*\{\s*stale\s*\}\s*(=\s*\{\s*\}\s*)?\)\s*=>/.test(limpo)).toBe(true);
  const { guardado, resto } = separaOGuarda(limpo);
  expect(guardado).toContain(fechar);
  if (soFechamento) expect(guardado.replace(fechar, '')).toMatch(/^[\s;{}]*$/);
  const nome = fechar.slice(0, fechar.indexOf('('));
  expect(resto.includes(`${nome}(`)).toBe(false);
  expect((limpo.match(/\bstale\b/g) || []).length).toBe(2);
  expect(resto).not.toMatch(/\b(return|throw)\b/);
  return { resto, comStrings };
}

describe('a varredura aceita as formas corretas e recusa as erradas', () => {
  const uso = (onDone) => `const a = 1;\n{/* <ContractModal> antigo, comentado */}\n<ContractModal lead={l} onClose={f} onDone=${onDone} />`;
  const CHAMADORES = [
    { nome: 'a ficha', fechar: 'setMatriculaOpen(false)', soFechamento: false },
    { nome: 'a Meta Diária', fechar: 'setMatriculaTarget(null)', soFechamento: false },
    { nome: 'o Kanban', fechar: 'setMatriculaLead(null)', soFechamento: true }
  ];
  const confere = (c, onDone) => exigeFecharSoSeNaoAtrasado(corpoDoOnDone(uso(onDone)), c.fechar, { soFechamento: c.soFechamento });

  describe.each(CHAMADORES)('$nome', (c) => {
    const f = c.fechar;
    it('aceita o `if` sem chaves, com chaves, com quebra de linha e com recargas depois', () => {
      expect(() => confere(c, `{({ stale } = {}) => { if (!stale) ${f}; recarrega(); }}`)).not.toThrow();
      expect(() => confere(c, `{({ stale } = {}) => { if (!stale) { ${f}; } recarrega(); }}`)).not.toThrow();
      expect(() => confere(c, `{({ stale } = {}) => {\n  if (!stale) {\n    ${f};\n  }\n  recarrega();\n}}`)).not.toThrow();
    });

    it('aceita a assinatura com ou sem o padrão `= {}`', () => {
      expect(() => confere(c, `{({ stale }) => { if (!stale) ${f}; }}`)).not.toThrow();
      expect(() => confere(c, `{({stale}={}) => { if (!stale) ${f}; }}`)).not.toThrow();
    });

    it('ignora um <ContractModal> dentro de comentário, de linha ou de bloco, em qualquer ponto do arquivo', () => {
      const fonte = `// <ContractModal onDone={() => x()} />\n/* <ContractModal> */\n${uso(`{({ stale }) => { if (!stale) ${f}; }}`)}\n{/* <ContractModal onDone={() => y()} /> */}`;
      expect(() => exigeFecharSoSeNaoAtrasado(corpoDoOnDone(fonte), f, { soFechamento: c.soFechamento })).not.toThrow();
    });

    // As seis formas que, com os testes verdes, deixavam as recargas fora do alcance ou o fechamento só como texto.
    it.each([
      ['return dentro do bloco', (x) => `{({ stale }) => { if (!stale) { ${x}; return; } recarrega(); }}`],
      ['return void sem chaves', (x) => `{({ stale }) => { if (!stale) return void ${x}; recarrega(); }}`],
      ['throw dentro do bloco', (x) => `{({ stale }) => { if (!stale) { ${x}; throw new Error('x'); } recarrega(); }}`],
      ['else com bloco depois das chaves', (x) => `{({ stale }) => { if (!stale) { ${x}; } else { recarrega(); } }}`],
      ['else com bloco depois do comando sem chaves', (x) => `{({ stale }) => { if (!stale) ${x}; else { recarrega(); } }}`],
      ['fechamento só como texto de string', (x) => `{({ stale }) => { if (!stale) { console.debug('${x}'); } recarrega(); }}`]
    ])('recusa: %s', (_nome, forma) => {
      expect(() => confere(c, forma(f))).toThrow();
    });

    it('recusa o fechamento fora do `if`, o `if (stale)`, o fechamento sempre e o handler nomeado', () => {
      expect(() => confere(c, `{() => ${f}}`)).toThrow();
      expect(() => confere(c, `{({ stale }) => { ${f}; }}`)).toThrow();
      expect(() => confere(c, `{({ stale }) => { if (stale) ${f}; }}`)).toThrow();
      expect(() => confere(c, `{({ stale }) => { if (!stale) { limpa(); } ${f}; }}`)).toThrow();
      expect(() => confere(c, `{({ stale }) => { if (stale) return; ${f}; }}`)).toThrow();
      expect(() => confere(c, `{({ stale }) => { ${f}; return; }}`)).toThrow();
      expect(() => confere(c, '{aoTerminar}')).toThrow();
    });
  });

  it('só o Kanban exige que o `if` guarde apenas o fechamento; a ficha e a Meta aceitam mais de um comando', () => {
    const [ficha, meta, kanban] = CHAMADORES;
    for (const c of [ficha, meta]) {
      expect(() => confere(c, `{({ stale }) => { if (!stale) { limpa(); ${c.fechar}; } }}`)).not.toThrow();
    }
    expect(() => confere(kanban, `{({ stale }) => { if (!stale) { limpa(); ${kanban.fechar}; } }}`)).toThrow();
  });
});

describe('os chamadores do ContractModal só fecham o modal quando o onDone não é atrasado', () => {
  it('a ficha (LeadProfileView)', () => {
    exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/LeadProfileView.jsx')), 'setMatriculaOpen(false)');
  });

  it('a Meta Diária (DailyGoalView)', () => {
    exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/DailyGoalView.jsx')), 'setMatriculaTarget(null)');
  });

  it('o Kanban fecha só se não for atrasado, e recarrega o quadro de qualquer jeito, pelas funções de agora', () => {
    const fonte = ler('../../views/KanbanView.jsx');
    const { resto } = exigeFecharSoSeNaoAtrasado(corpoDoOnDone(fonte), 'setMatriculaLead(null)', { soFechamento: true });
    // O que a gravação muda no quadro continua acontecendo com `stale`: nada disso fica dentro de um `if (!stale)`.
    // As recargas vêm do ref, não do closure: o `onDone` é o da renderização em que a pessoa clicou em
    // Confirmar, e a consulta daquela hora (mês ou funil já trocados) é a velha.
    for (const recarga of ['if (wasPerda) reloadsRef.current.refreshLost();', 'if (wasRenewal) reloadsRef.current.renewalReload();',
      'if (wasUpgrade) reloadsRef.current.upgradeReload();', 'if (wasUpgrade) setUpgradeCountEpoch((e) => e + 1);',
      'reloadsRef.current.wonReload();']) {
      expect(resto).toContain(recarga);
    }
    expect(resto).not.toMatch(/(^|[^.\w])(refreshLost|renewalReload|upgradeReload|wonReload)\(/);
    // O ref guarda as quatro funções da última renderização.
    expect(semComentarios(fonte)).toContain('const reloadsRef = useLatestRef({ refreshLost, renewalReload, upgradeReload, wonReload });');
    // O que decide cada recarga vem do lead da abertura do modal (o closure), não do estado de agora.
    const { comStrings } = corpoDoOnDone(fonte);
    expect(comStrings).toContain("const wasPerda = matriculaLead?.status === 'Perda';");
    expect(comStrings).toContain('const wasRenewal = Boolean(matriculaLead?._renewalCard);');
    expect(comStrings).toContain('const wasUpgrade = Boolean(matriculaLead?._upgradeCard);');
  });

  it('no Kanban, toda recarga do quadro passa pelo ref, também nos handlers que esperam uma gravação', () => {
    // Mover de etapa, recusar o upgrade e marcar perda recarregam depois de um `await` da gravação,
    // que sem internet só termina quando a rede volta. Pelo closure, a recarga buscaria o mês ou o
    // funil de antes de a pessoa trocar o quadro. Chamada solta de uma das quatro é recusada.
    const limpo = semStrings(semComentarios(ler('../../views/KanbanView.jsx')));
    const soltas = limpo.match(/(^|[^.\w])(refreshLost|renewalReload|upgradeReload|wonReload)\(/g) || [];
    expect(soltas).toEqual([]);
  });
});
