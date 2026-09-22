// O card do Pipeline virou link de verdade: Ctrl+clique, botão do meio e
// "Abrir em nova aba" abrem a ficha, e a setinha do rodapé abre em OUTRA GUIA
// já no clique simples. O link ENVOLVE o conteúdo em vez de esticar uma camada
// por cima, senão os tooltips do card (chips, motivo da perda e consultor)
// somem. O card continua sendo o que se arrasta.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { LeadProfileContext } from '../../contexts/LeadProfileContext.jsx';
import { hrefFor } from '../routes.js';

// O KanbanView importa src/lib/firebase.js, que inicializa o Firebase ao ser
// importado e quebra em node. O card não usa nada disso.
vi.mock('../firebase.js', () => ({
  appId: 'acad', LEADS_PATH: 'leads', INTERACTIONS_PATH: 'inter', db: {}, auth: {}, storage: {},
}));

const { KanbanCard } = await import('../../views/KanbanView.jsx');

const TENANT = 'acad';
const profile = {
  openProfile: () => {},
  leadHref: (leadId) => hrefFor(TENANT, 'ficha', { leadId }),
  from: 'kanban',
};

const LEAD = {
  id: 'abc123',
  name: 'Ana Lima',
  status: 'Perda',
  lossReason: 'Achou caro para o orçamento dela',
  source: 'Instagram',
  modalidade: 'Musculação e pilates',
  consultantName: 'Bruno Souza',
};

function render(lead = LEAD) {
  return renderToString(
    createElement(MemoryRouter, { initialEntries: ['/acad/pipeline'] },
      createElement(LeadProfileContext.Provider, { value: profile },
        createElement(KanbanCard, {
          lead,
          columnColor: 'blue',
          isDragging: false,
          lastDate: null,
          onDragStart: () => {},
          onDragEnd: () => {},
          onMoveRequest: () => {},
        }))));
}

// O primeiro <a> do card é o que envolve o bloco de cima.
function primeiroLink(html) {
  const inicio = html.indexOf('<a ');
  return html.slice(inicio, html.indexOf('</a>', inicio));
}

describe('card do Pipeline', () => {
  it('o corpo do card é um link para a ficha', () => {
    const html = render();
    expect(html).toContain('href="/acad/ficha/abc123"');
    // Corpo, nome do consultor e setinha.
    expect(html.match(/<a /g)).toHaveLength(3);
  });

  it('os tooltips do bloco de cima continuam dentro do link', () => {
    const corpo = primeiroLink(render());
    expect(corpo).toContain('title="Ana Lima"');
    expect(corpo).toContain('title="Achou caro para o orçamento dela"');
    expect(corpo).toContain('title="Instagram"');
    expect(corpo).toContain('title="Musculação e pilates"');
  });

  it('o nome do consultor é link com o tooltip e fora da ordem do Tab', () => {
    const html = render();
    const i = html.indexOf('title="Consultor: Bruno Souza"');
    expect(i).toBeGreaterThan(-1);
    // A TAG INTEIRA, não o pedaço até o title: class e href saem depois do
    // espalhamento das props, então parar no title não acharia nenhum dos dois.
    const abertura = html.lastIndexOf('<a ', i);
    const tag = html.slice(abertura, html.indexOf('>', i));
    expect(tag).toContain('tabindex="-1"');
    expect(tag).toContain('href="/acad/ficha/abc123"');
  });

  it('os links do card não são arrastáveis, e o card é', () => {
    const html = render();
    expect(html.match(/draggable="false"/g)).toHaveLength(3);
    expect(html).toContain('<article');
    expect(html).toContain('draggable="true"');
  });

  it('o card não abre mais a ficha pelo onClick do container', () => {
    const el = KanbanCard.type({
      lead: LEAD, columnColor: 'blue', isDragging: false, lastDate: null,
      onDragStart: () => {}, onDragEnd: () => {}, onMoveRequest: () => {},
    });
    expect(el.type).toBe('article');
    expect(el.props.onClick).toBeUndefined();
    expect(el.props.draggable).toBe(true);
    expect(el.props['data-no-pan']).toBe('true');
  });

  it('a setinha abre a ficha em outra guia', () => {
    const html = render();
    const i = html.indexOf('target="_blank"');
    expect(i).toBeGreaterThan(-1);
    const abertura = html.lastIndexOf('<a ', i);
    const setinha = html.slice(abertura, html.indexOf('</a>', i));
    expect(setinha).toContain('href="/acad/ficha/abc123"');
    expect(setinha).toContain('rel="noopener"');
  });

  it('o rótulo da setinha avisa que abre em outra guia', () => {
    const html = render();
    expect(html).toContain('title="Abrir ficha em outra guia"');
    expect(html).toContain('aria-label="Abrir ficha em outra guia"');
  });

  it('Mover continua botão', () => {
    const html = render();
    expect(html).toContain('aria-label="Mover lead para outra etapa"');
    const i = html.indexOf('aria-label="Mover lead para outra etapa"');
    expect(html.lastIndexOf('<button', i)).toBeGreaterThan(html.lastIndexOf('<a ', i));
  });

  it('id que não serve para endereço vira texto sem link', () => {
    const html = render({ ...LEAD, id: 'a/b' });
    expect(html).not.toContain('<a ');
    expect(html).toContain('Ana Lima');
  });
});
