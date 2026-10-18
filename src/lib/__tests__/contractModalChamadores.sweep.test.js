// O ContractModal avisa os chamadores quando o onDone chega depois de o modal já ter sido
// fechado pelo X (gravação pendente sem internet, modal reaberto): `onDone({ stale })`.
// Cada chamador só fecha o modal quando `stale` é falso. O Kanban faz mais que fechar:
// recarrega o quadro mesmo com `stale`, porque a gravação valeu, e esse resto fica FORA do `if`.
// As três telas importam o Firebase e são grandes demais para montar num teste, como as
// outras varreduras de view deste projeto: esta lê o código e reprova quem mudar o desenho.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// O corpo do `onDone={...}` do <ContractModal>, sem comentários e com os espaços normalizados.
function corpoDoOnDone(fonte) {
  const usos = [...fonte.matchAll(/<ContractModal[\s>]/g)];
  expect(usos.length).toBe(1);
  const chave = fonte.indexOf('onDone={', usos[0].index) + 'onDone='.length;
  let nivel = 0;
  let fim = chave;
  for (; fim < fonte.length; fim += 1) {
    if (fonte[fim] === '{') nivel += 1;
    else if (fonte[fim] === '}') { nivel -= 1; if (!nivel) break; }
  }
  return semComentarios(fonte.slice(chave + 1, fim)).replace(/\s+/g, ' ').trim();
}

// `stale` só pode aparecer na assinatura e no `if` do fechamento, nada mais: um `return` ou um
// `if (stale)` em volta de outra coisa (as recargas do Kanban) esconderia o resto.
function exigeFecharSoSeNaoAtrasado(corpo, fechar) {
  expect(corpo.startsWith('({ stale } = {}) =>')).toBe(true);
  expect(corpo).toContain(`if (!stale) ${fechar};`);
  const nome = fechar.slice(0, fechar.indexOf('('));
  expect(corpo.replace(`if (!stale) ${fechar};`, '').includes(`${nome}(`)).toBe(false);
  expect((corpo.match(/\bstale\b/g) || []).length).toBe(2);
}

describe('os chamadores do ContractModal só fecham o modal quando o onDone não é atrasado', () => {
  it('a ficha (LeadProfileView)', () => {
    exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/LeadProfileView.jsx')), 'setMatriculaOpen(false)');
  });

  it('a Meta Diária (DailyGoalView)', () => {
    exigeFecharSoSeNaoAtrasado(corpoDoOnDone(ler('../../views/DailyGoalView.jsx')), 'setMatriculaTarget(null)');
  });

  it('o Kanban fecha só se não for atrasado, e recarrega o quadro de qualquer jeito', () => {
    const corpo = corpoDoOnDone(ler('../../views/KanbanView.jsx'));
    exigeFecharSoSeNaoAtrasado(corpo, 'setMatriculaLead(null)');
    // O que a gravação muda no quadro continua acontecendo com `stale`: nada disso fica dentro de um `if (!stale)`.
    for (const recarga of ['if (wasPerda) refreshLost();', 'if (wasRenewal) renewalReload();', 'if (wasUpgrade) upgradeReload();',
      'if (wasUpgrade) setUpgradeCountEpoch((e) => e + 1);', 'wonReload();']) {
      expect(corpo).toContain(recarga);
    }
    // O que decide cada recarga vem do lead da abertura do modal (o closure), não do estado de agora.
    expect(corpo).toContain("const wasPerda = matriculaLead?.status === 'Perda';");
    expect(corpo).toContain('const wasRenewal = Boolean(matriculaLead?._renewalCard);');
    expect(corpo).toContain('const wasUpgrade = Boolean(matriculaLead?._upgradeCard);');
  });
});
