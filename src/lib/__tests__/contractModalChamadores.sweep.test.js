// O ContractModal avisa os chamadores quando o onDone chega depois de o modal já ter sido
// fechado pelo X (gravação pendente sem internet, modal reaberto): `onDone({ stale })`.
// Cada chamador só fecha o modal quando `stale` é falso. O Kanban faz mais que fechar:
// recarrega o quadro mesmo com `stale`, porque a gravação valeu, e esse resto fica FORA do `if`.
// As três telas importam o Firebase e são grandes demais para montar num teste, como as
// outras varreduras de view deste projeto: esta lê o código e reprova quem mudar o desenho.
//
// O `onDone` tem de ser escrito EM LINHA no `<ContractModal>` (`onDone={({ stale }) => {...}}`),
// de propósito: a varredura confere o corpo no ponto de uso. Um `onDone={handlerNomeado}` leva o
// corpo para outro lugar do arquivo, e aí a varredura não saberia mais onde está o fechamento
// nem se ele ficou dentro do `if (!stale)`. Por isso essa forma é recusada.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
// Tira os comentários do arquivo inteiro (inclusive `{/* ... */}` de JSX), sem tocar em `://` de URL.
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const compacta = (t) => t.replace(/\s+/g, ' ').trim();

// O `{ ... }` que começa em `ini`, até a chave que o fecha (as chaves de dentro contam).
function blocoEquilibrado(t, ini) {
  let nivel = 0;
  for (let i = ini; i < t.length; i += 1) {
    if (t[i] === '{') nivel += 1;
    else if (t[i] === '}') { nivel -= 1; if (!nivel) return { conteudo: t.slice(ini + 1, i), fim: i }; }
  }
  throw new Error('chaves sem fechar');
}

// O corpo do `onDone={...}` do único <ContractModal> do arquivo, sem comentários e compactado.
function corpoDoOnDone(fonte) {
  const limpo = semComentarios(fonte);
  const usos = [...limpo.matchAll(/<ContractModal[\s>]/g)];
  expect(usos.length).toBe(1);
  const ini = limpo.indexOf('onDone={', usos[0].index) + 'onDone='.length;
  return compacta(blocoEquilibrado(limpo, ini).conteudo);
}

// Tira o `if (!stale)` do corpo e devolve o que ele guardava (com ou sem chaves, com um ou mais comandos).
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
  return { guardado, resto: compacta(corpo.slice(0, a) + corpo.slice(fim)) };
}

// O corpo começa por `({ stale })` ou `({ stale } = {})`, o fechamento está dentro do `if (!stale)`
// e não aparece em lugar nenhum fora dele, e `stale` só existe na assinatura e nesse `if`.
function exigeFecharSoSeNaoAtrasado(corpo, fechar) {
  expect(/^\(\s*\{\s*stale\s*\}\s*(=\s*\{\s*\}\s*)?\)\s*=>/.test(corpo)).toBe(true);
  const { guardado, resto } = separaOGuarda(corpo);
  expect(guardado).toContain(fechar);
  const nome = fechar.slice(0, fechar.indexOf('('));
  expect(resto.includes(`${nome}(`)).toBe(false);
  expect((corpo.match(/\bstale\b/g) || []).length).toBe(2);
  return resto;
}

describe('a varredura aceita as formas corretas e recusa as erradas', () => {
  const uso = (onDone) => `const a = 1;\n{/* <ContractModal> antigo, comentado */}\n<ContractModal lead={l} onClose={f} onDone=${onDone} />`;
  const fecha = (onDone) => exigeFecharSoSeNaoAtrasado(corpoDoOnDone(uso(onDone)), 'setAberto(false)');

  it('aceita o `if` sem chaves, com chaves, com quebra de linha e com mais de um comando', () => {
    expect(() => fecha('{({ stale } = {}) => { if (!stale) setAberto(false); }}')).not.toThrow();
    expect(() => fecha('{({ stale } = {}) => { if (!stale) { setAberto(false); } }}')).not.toThrow();
    expect(() => fecha('{({ stale } = {}) => {\n  if (!stale) {\n    setAberto(false);\n  }\n}}')).not.toThrow();
    expect(() => fecha('{({ stale } = {}) => { if (!stale) { limpa(); setAberto(false); } recarrega(); }}')).not.toThrow();
  });

  it('aceita a assinatura com ou sem o padrão `= {}`', () => {
    expect(() => fecha('{({ stale }) => { if (!stale) setAberto(false); }}')).not.toThrow();
    expect(() => fecha('{({stale}={}) => { if (!stale) setAberto(false); }}')).not.toThrow();
  });

  it('ignora um <ContractModal> dentro de comentário, de linha ou de bloco, em qualquer ponto do arquivo', () => {
    const fonte = `// <ContractModal onDone={() => x()} />\n/* <ContractModal> */\n${uso('{({ stale }) => { if (!stale) setAberto(false); }}')}\n{/* <ContractModal onDone={() => y()} /> */}`;
    expect(() => exigeFecharSoSeNaoAtrasado(corpoDoOnDone(fonte), 'setAberto(false)')).not.toThrow();
  });

  it('recusa o fechamento fora do `if`, o `if (stale)`, o fechamento sempre e o handler nomeado', () => {
    expect(() => fecha('{() => setAberto(false)}')).toThrow();
    expect(() => fecha('{({ stale }) => { setAberto(false); }}')).toThrow();
    expect(() => fecha('{({ stale }) => { if (stale) setAberto(false); }}')).toThrow();
    expect(() => fecha('{({ stale }) => { if (!stale) { limpa(); } setAberto(false); }}')).toThrow();
    expect(() => fecha('{({ stale }) => { if (stale) return; setAberto(false); }}')).toThrow();
    expect(() => fecha('{aoTerminar}')).toThrow();
  });
});

describe('os chamadores do ContractModal só fecham o modal quando o onDone não é atrasado', () => {
  it('a ficha (LeadProfileView)', () => {
    exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/LeadProfileView.jsx')), 'setMatriculaOpen(false)');
  });

  it('a Meta Diária (DailyGoalView)', () => {
    exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/DailyGoalView.jsx')), 'setMatriculaTarget(null)');
  });

  it('o Kanban fecha só se não for atrasado, e recarrega o quadro de qualquer jeito', () => {
    const resto = exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/KanbanView.jsx')), 'setMatriculaLead(null)');
    // O que a gravação muda no quadro continua acontecendo com `stale`: nada disso fica dentro de um `if (!stale)`.
    for (const recarga of ['if (wasPerda) refreshLost();', 'if (wasRenewal) renewalReload();', 'if (wasUpgrade) upgradeReload();',
      'if (wasUpgrade) setUpgradeCountEpoch((e) => e + 1);', 'wonReload();']) {
      expect(resto).toContain(recarga);
    }
    // O que decide cada recarga vem do lead da abertura do modal (o closure), não do estado de agora.
    expect(resto).toContain("const wasPerda = matriculaLead?.status === 'Perda';");
    expect(resto).toContain('const wasRenewal = Boolean(matriculaLead?._renewalCard);');
    expect(resto).toContain('const wasUpgrade = Boolean(matriculaLead?._upgradeCard);');
  });
});
