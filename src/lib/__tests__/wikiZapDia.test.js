// A Central de ajuda explica o cartão do dia e a prova do Stronizap (Parte B,
// PR 3) sem confundir quem não usa o Stronizap: cada parágrafo diz que, sem
// ele, nada muda. Não há novidade no sino, porque ela chegaria também a quem
// não tem a integração.
import { describe, it, expect } from 'vitest';
import { getWikiArticle } from '../wiki.js';

const textos = (id) => getWikiArticle(id).blocks.flatMap((b) => [b.text, ...(b.items || [])]).filter(Boolean);

describe('Central de ajuda: Stronizap na ficha e na Meta', () => {
  it('a ficha explica o cartão do dia e que sem o Stronizap nada muda', () => {
    const p = textos('ficha').find((t) => t.includes('Conversa no Stronizap'));
    expect(p).toBeDefined();
    expect(p).toContain('Sem o Stronizap');
    expect(p).not.toMatch(/[—–]/);
  });

  it('a Meta explica a prova, que a mensagem não conclui a tarefa e que sem o Stronizap nada muda', () => {
    const p = textos('meta-diaria').find((t) => t.includes('pelo Stronizap'));
    expect(p).toBeDefined();
    expect(p).toContain('Conversou com');
    expect(p).toContain('não conclui');
    expect(p).toContain('Sem o Stronizap');
    expect(p).not.toMatch(/[—–]/);
  });
});
