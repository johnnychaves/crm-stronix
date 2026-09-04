import { describe, it, expect } from 'vitest';
import { maskSensitive, scrubDeep, isNoise, scrubEvent, stripQuery, scrubBreadcrumb } from '../sentryScrub.js';

describe('maskSensitive', () => {
  it('mascara CPF formatado', () => {
    expect(maskSensitive('cliente 123.456.789-01 nao encontrado'))
      .toBe('cliente [cpf] nao encontrado');
  });

  it('mascara CPF sem pontuacao', () => {
    expect(maskSensitive('doc 12345678901 invalido'))
      .toBe('doc [documento] invalido');
  });

  it('mascara e-mail', () => {
    expect(maskSensitive('falha para joao.silva@academia.com.br'))
      .toBe('falha para [email]');
  });

  it('mascara telefone com DDD e nono digito', () => {
    expect(maskSensitive('whatsapp (11) 98765-4321 recusado'))
      .toBe('whatsapp [telefone] recusado');
  });

  it('mascara telefone sem formatacao', () => {
    expect(maskSensitive('tel 11987654321')).toBe('tel [telefone]');
  });

  it('nao mascara timestamp de 13 digitos', () => {
    expect(maskSensitive('expiresAt 1754246400000')).toBe('expiresAt 1754246400000');
  });

  it('deixa texto sem dado pessoal intacto', () => {
    const msg = 'TypeError: cannot read property status of undefined';
    expect(maskSensitive(msg)).toBe(msg);
  });

  it('devolve valor nao-string sem alterar', () => {
    expect(maskSensitive(42)).toBe(42);
    expect(maskSensitive(null)).toBe(null);
  });
});

describe('scrubDeep', () => {
  it('percorre objeto aninhado', () => {
    const input = { lead: { nome: 'Ana', email: 'ana@x.com' }, ok: true };
    expect(scrubDeep(input)).toEqual({ lead: { nome: 'Ana', email: '[email]' }, ok: true });
  });

  it('percorre array', () => {
    expect(scrubDeep(['a@b.com', 'texto'])).toEqual(['[email]', 'texto']);
  });

  it('preserva numeros e booleanos', () => {
    expect(scrubDeep({ n: 7, b: false })).toEqual({ n: 7, b: false });
  });

  it('para na profundidade maxima sem estourar a pilha', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'x@y.com' } } } } } } };
    expect(() => scrubDeep(deep)).not.toThrow();
  });
});

describe('isNoise', () => {
  it('descarta ResizeObserver loop', () => {
    expect(isNoise({ exception: { values: [{ value: 'ResizeObserver loop limit exceeded' }] } })).toBe(true);
  });

  it('descarta erro vindo de extensao do navegador', () => {
    const event = {
      exception: {
        values: [{
          value: 'boom',
          stacktrace: { frames: [{ filename: 'chrome-extension://abc/inject.js' }] },
        }],
      },
    };
    expect(isNoise(event)).toBe(true);
  });

  it('mantem erro normal do app', () => {
    const event = {
      exception: {
        values: [{
          value: 'TypeError: x is undefined',
          stacktrace: { frames: [{ filename: 'https://app.stronilead.com.br/assets/index.js' }] },
        }],
      },
    };
    expect(isNoise(event)).toBe(false);
  });

  it('mantem evento sem excecao', () => {
    expect(isNoise({ message: 'log qualquer' })).toBe(false);
  });
});

describe('scrubEvent', () => {
  it('mascara a mensagem da excecao', () => {
    const event = { exception: { values: [{ value: 'lead ana@x.com falhou' }] } };
    expect(scrubEvent(event).exception.values[0].value).toBe('lead [email] falhou');
  });

  it('mascara a mensagem solta', () => {
    expect(scrubEvent({ message: 'tel 11987654321' }).message).toBe('tel [telefone]');
  });

  it('remove o corpo da requisicao', () => {
    const event = { request: { url: '/api/plans', data: { cpf: '123.456.789-01' } } };
    const out = scrubEvent(event);
    expect(out.request.data).toBeUndefined();
    expect(out.request.url).toBe('/api/plans');
  });

  it('mascara breadcrumbs', () => {
    const event = { breadcrumbs: [{ message: 'buscou joao@x.com' }] };
    expect(scrubEvent(event).breadcrumbs[0].message).toBe('buscou [email]');
  });

  it('mascara o bloco extra', () => {
    const event = { extra: { payload: { email: 'a@b.com' } } };
    expect(scrubEvent(event).extra.payload.email).toBe('[email]');
  });

  it('devolve null para evento de ruido', () => {
    expect(scrubEvent({ exception: { values: [{ value: 'ResizeObserver loop' }] } })).toBe(null);
  });
});

describe('stripQuery', () => {
  it('corta a query string do link de convite', () => {
    expect(stripQuery('https://app.com/?invite=abc-123&t=academia'))
      .toBe('https://app.com/');
  });

  it('corta o fragmento', () => {
    expect(stripQuery('https://app.com/lead#token=xyz')).toBe('https://app.com/lead');
  });

  it('deixa URL sem query intacta', () => {
    expect(stripQuery('https://app.com/leads')).toBe('https://app.com/leads');
  });

  it('devolve valor nao-string sem alterar', () => {
    expect(stripQuery(null)).toBe(null);
    expect(stripQuery(undefined)).toBe(undefined);
  });
});

describe('scrubEvent — URL', () => {
  it('tira o token de convite da URL da requisicao', () => {
    const event = { request: { url: 'https://app.com/?invite=7f3a-9b1c&t=academia' } };
    expect(scrubEvent(event).request.url).toBe('https://app.com/');
  });

  it('remove a query_string separada', () => {
    const event = { request: { url: 'https://app.com/', query_string: 'invite=7f3a-9b1c' } };
    expect(scrubEvent(event).request.query_string).toBeUndefined();
  });

  it('corta a query nas spans de uma transacao', () => {
    const event = {
      type: 'transaction',
      spans: [{ data: { 'url.full': 'https://app.com/?invite=7f3a-9b1c', 'http.method': 'GET' } }]
    };
    const out = scrubEvent(event);
    expect(out.spans[0].data['url.full']).toBe('https://app.com/');
    expect(out.spans[0].data['http.method']).toBe('GET');
  });

  it('corta a query no contexto de trace', () => {
    const event = { contexts: { trace: { data: { url: 'https://app.com/?invite=abc' } } } };
    expect(scrubEvent(event).contexts.trace.data.url).toBe('https://app.com/');
  });

  it('nao descarta transacao por falta de exception', () => {
    const event = { type: 'transaction', transaction: '/leads' };
    expect(scrubEvent(event)).not.toBe(null);
  });
});

describe('scrubBreadcrumb', () => {
  it('redige o nome do cliente vindo do title do card', () => {
    const crumb = { category: 'ui.click', message: 'div.card > span[title="Maria Souza"]' };
    expect(scrubBreadcrumb(crumb).message).toBe('div.card > span[title="[redigido]"]');
  });

  it('redige alt e aria-label', () => {
    const crumb = { category: 'ui.click', message: 'img[alt="Joao Lima"][aria-label="Abrir ficha de Joao"]' };
    expect(scrubBreadcrumb(crumb).message)
      .toBe('img[alt="[redigido]"][aria-label="[redigido]"]');
  });

  it('preserva classe e tag, que sao o valor de diagnostico', () => {
    const crumb = { category: 'ui.click', message: 'button.btn-primary[title="Ana"]' };
    expect(scrubBreadcrumb(crumb).message).toBe('button.btn-primary[title="[redigido]"]');
  });

  it('mascara PII em breadcrumb que nao e de UI', () => {
    const crumb = { category: 'fetch', message: 'POST /api/x tel 11987654321' };
    expect(scrubBreadcrumb(crumb).message).toBe('POST /api/x tel [telefone]');
  });

  it('corta a query da URL em breadcrumb de navegacao', () => {
    const crumb = { category: 'navigation', data: { to: 'https://app.com/?invite=abc', from: '/' } };
    const out = scrubBreadcrumb(crumb);
    expect(out.data.to).toBe('https://app.com/');
  });

  it('devolve o breadcrumb nulo sem quebrar', () => {
    expect(scrubBreadcrumb(null)).toBe(null);
  });
});
