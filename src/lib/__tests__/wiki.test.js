// Central de ajuda: integridade do conteúdo (ids, categorias, blocos) e a busca.
// O conteúdo mora no código, então o teste é a barreira contra artigo órfão,
// categoria inexistente ou bloco de tipo desconhecido que o renderer ignoraria.

import { describe, it, expect } from 'vitest';
import { WIKI_ARTICLES, WIKI_CATEGORIES, BLOCK_KINDS, searchWiki, getWikiArticle } from '../wiki.js';
import { ANNOUNCEMENTS } from '../announcements.js';

describe('conteúdo da wiki', () => {
  it('todo artigo tem id único, título, resumo e pelo menos um bloco', () => {
    const ids = WIKI_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    WIKI_ARTICLES.forEach((a) => {
      expect(a.title?.length, `artigo ${a.id} sem título`).toBeGreaterThan(0);
      expect(a.summary?.length, `artigo ${a.id} sem resumo`).toBeGreaterThan(0);
      expect(a.blocks?.length, `artigo ${a.id} sem conteúdo`).toBeGreaterThan(0);
    });
  });

  it('toda categoria de artigo existe no índice', () => {
    const known = new Set(WIKI_CATEGORIES.map((c) => c.id));
    WIKI_ARTICLES.forEach((a) => expect(known.has(a.category), `categoria "${a.category}" (${a.id})`).toBe(true));
  });

  it('todo bloco tem um tipo que o renderer conhece', () => {
    WIKI_ARTICLES.forEach((a) => a.blocks.forEach((b) => {
      expect(BLOCK_KINDS.includes(b.t), `bloco "${b.t}" em ${a.id}`).toBe(true);
    }));
  });

  it('toda categoria do índice tem ao menos um artigo (sem seção vazia)', () => {
    WIKI_CATEGORIES.forEach((c) => {
      expect(WIKI_ARTICLES.some((a) => a.category === c.id), `categoria vazia: ${c.id}`).toBe(true);
    });
  });

  it('cobre as indicações — o que acabou de ser lançado', () => {
    const texto = JSON.stringify(WIKI_ARTICLES).toLowerCase();
    expect(texto).toContain('indica');
    expect(texto).toContain('aguardando ação'.toLowerCase());
  });

  it('cobre o funil de vencidos, com os três desfechos e o prazo', () => {
    const a = getWikiArticle('vencidos');
    expect(a?.category).toBe('fechamento');
    const texto = JSON.stringify(a).toLowerCase();
    ['reativou', 'não vai voltar', 'reagendar contato', 'metas & ritmo'].forEach((termo) => {
      expect(texto, `artigo de vencidos sem "${termo}"`).toContain(termo.toLowerCase());
    });
  });

  // O sino manda o leitor direto pro artigo da novidade. Aviso apontando pra
  // artigo que não existe abre a Central de ajuda em branco.
  it('todo aviso do sino aponta para um artigo que existe', () => {
    ANNOUNCEMENTS.filter((a) => a.articleId).forEach((a) => {
      expect(getWikiArticle(a.articleId), `aviso "${a.id}" aponta pra artigo inexistente`).toBeTruthy();
    });
  });
});

describe('searchWiki', () => {
  it('busca vazia devolve tudo', () => {
    expect(searchWiki('')).toHaveLength(WIKI_ARTICLES.length);
    expect(searchWiki('   ')).toHaveLength(WIKI_ARTICLES.length);
  });

  it('acha por título ignorando acento e caixa', () => {
    const alvo = WIKI_ARTICLES[0];
    const semAcento = alvo.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    expect(searchWiki(semAcento).map((a) => a.id)).toContain(alvo.id);
  });

  it('acha por texto do corpo, não só pelo título', () => {
    expect(searchWiki('aguardando acao').length).toBeGreaterThan(0);
  });

  it('busca sem resultado devolve lista vazia', () => {
    expect(searchWiki('xyzabc123nadaaqui')).toEqual([]);
  });
});

describe('getWikiArticle', () => {
  it('devolve o artigo pelo id e null quando não existe', () => {
    expect(getWikiArticle(WIKI_ARTICLES[0].id)?.id).toBe(WIKI_ARTICLES[0].id);
    expect(getWikiArticle('inexistente')).toBe(null);
    expect(getWikiArticle(null)).toBe(null);
  });
});
