import { describe, it, expect } from 'vitest';
import {
  maskSensitive, scrubDeep, isNoise, scrubEvent, stripQuery, scrubBreadcrumb,
  scrubLeadPath, scrubLeadPathsDeep, scrubSpan
} from '../sentryScrub.js';

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

  it('mascara a chave do zap', () => {
    const chave = `szk_${'a1b2'.repeat(12)}`; // 48 hex, formato de generateZapKey
    expect(maskSensitive(`erro com a chave ${chave} invalida`))
      .toBe('erro com a chave [chave] invalida');
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

  it('apaga vars dos frames da excecao', () => {
    const event = {
      exception: {
        values: [{
          value: 'erro',
          stacktrace: {
            frames: [
              { function: 'handleMatch', vars: { chave: 'szk_x', phones: ['5511987654321'] } },
              { function: 'outraFuncao', vars: { x: 1 } }
            ]
          }
        }]
      }
    };
    const frames = scrubEvent(event).exception.values[0].stacktrace.frames;
    expect(frames.every((f) => !('vars' in f))).toBe(true);
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

  it('mantem so os headers permitidos da requisicao', () => {
    const event = {
      request: {
        url: '/api/zap',
        headers: {
          'x-stronizap-key': 'szk_segredo',
          'asaas-access-token': 'token-do-webhook',
          authorization: 'Bearer xyz',
          cookie: 'sessao=1',
          'content-type': 'application/json',
          'User-Agent': 'node',
          'x-vercel-id': 'gru1::abc'
        }
      }
    };
    expect(scrubEvent(event).request.headers).toEqual({
      'content-type': 'application/json',
      'User-Agent': 'node',
      'x-vercel-id': 'gru1::abc'
    });
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

  it('corta o http.query em breadcrumb de pedido do backend', () => {
    const crumb = { category: 'http', data: { 'http.query': '?phone=5511987654321' } };
    expect(scrubBreadcrumb(crumb).data).not.toHaveProperty('http.query');
  });

  it('devolve o breadcrumb nulo sem quebrar', () => {
    expect(scrubBreadcrumb(null)).toBe(null);
  });

  it('devolve null em vez de derrubar quem chamou quando data tem getter que lança', () => {
    const crumb = {
      category: 'fetch',
      get data() { throw new Error('boom'); }
    };
    expect(scrubBreadcrumb(crumb)).toBe(null);
  });
});

// Com endereço por tela, a ficha vira /<academia>/ficha/<id do lead>. O id não
// pode sair para o Sentry em campo nenhum. As formas abaixo são as que o SDK
// 10.69 produz de verdade (request.url, nome da transação no escopo, migalha
// de navegação, url.path, span do documento, span do INP e medidas de LCP).
const ID = 'Ab12Cd34Ef56Gh78Ij90';
const FICHA = `/stronix-crm-app/ficha/${ID}`;

describe('scrubLeadPath', () => {
  it('troca o id da ficha pela marca :leadId e mantém o resto', () => {
    expect(scrubLeadPath(`https://stronilead.com.br${FICHA}?x=1`))
      .toBe('https://stronilead.com.br/stronix-crm-app/ficha/:leadId?x=1');
  });

  it('é idempotente e não mexe no molde de rota', () => {
    expect(scrubLeadPath('/:tenant/ficha/:leadId')).toBe('/:tenant/ficha/:leadId');
    expect(scrubLeadPath(scrubLeadPath(FICHA))).toBe('/stronix-crm-app/ficha/:leadId');
  });

  it('não distingue maiúscula', () => {
    expect(scrubLeadPath('/S/FICHA/Ab12')).toBe('/S/FICHA/:leadId');
  });

  it('para em espaço e aspas quando o caminho está no meio de uma frase', () => {
    expect(scrubLeadPath('falhou ao abrir /s/ficha/Ab12 agora')).toBe('falhou ao abrir /s/ficha/:leadId agora');
    expect(scrubLeadPath('href="/s/ficha/Ab12" quebrou')).toBe('href="/s/ficha/:leadId" quebrou');
  });

  it('pega id com caractere codificado', () => {
    expect(scrubLeadPath('/s/ficha/Jos%C3%A9%2050%25')).toBe('/s/ficha/:leadId');
  });

  it('deixa as outras telas, o slug e o que não é texto como estão', () => {
    expect(scrubLeadPath('/stronix-crm-app/pipeline')).toBe('/stronix-crm-app/pipeline');
    expect(scrubLeadPath('/s/leads/aulas')).toBe('/s/leads/aulas');
    expect(scrubLeadPath('/s/fichas/x')).toBe('/s/fichas/x');
    expect(scrubLeadPath('/stronix-crm-app')).toBe('/stronix-crm-app');
    expect(scrubLeadPath(null)).toBe(null);
    expect(scrubLeadPath(42)).toBe(42);
  });
});

describe('scrubLeadPathsDeep', () => {
  it('troca em campo que não está em lista nenhuma, em qualquer profundidade', () => {
    const event = { contexts: { qualquer: { a: { b: { c: { d: { e: { f: FICHA } } } } } } } };
    expect(scrubLeadPathsDeep(event).contexts.qualquer.a.b.c.d.e.f).toBe('/stronix-crm-app/ficha/:leadId');
  });

  it('aguenta referência circular', () => {
    const node = { url: FICHA };
    node.self = node;
    expect(() => scrubLeadPathsDeep(node)).not.toThrow();
    expect(node.url).toBe('/stronix-crm-app/ficha/:leadId');
  });

  it('não entra no sdkProcessingMetadata, que guarda objeto vivo do SDK', () => {
    const vivo = { url: FICHA };
    const event = { sdkProcessingMetadata: { normalizedRequest: vivo } };
    scrubLeadPathsDeep(event);
    expect(event.sdkProcessingMetadata.normalizedRequest).toBe(vivo);
    expect(vivo.url).toBe(FICHA);
  });

  it('não grava em objeto congelado quando não há nada a trocar', () => {
    const congelado = Object.freeze({ url: '/stronix-crm-app/pipeline' });
    expect(() => scrubLeadPathsDeep({ congelado })).not.toThrow();
  });
});

describe('scrubEvent: id do lead no endereço', () => {
  it('tira o id e a query do request.url', () => {
    const event = { request: { url: `https://stronilead.com.br${FICHA}?invite=x` } };
    expect(scrubEvent(event).request.url).toBe('https://stronilead.com.br/stronix-crm-app/ficha/:leadId');
  });

  it('troca o id no nome da transação que o SDK copia para todo erro', () => {
    expect(scrubEvent({ transaction: FICHA }).transaction).toBe('/stronix-crm-app/ficha/:leadId');
    expect(scrubEvent({ transaction: '/:tenant/ficha/:leadId' }).transaction).toBe('/:tenant/ficha/:leadId');
  });

  it('troca o id nas migalhas de navegação guardadas no evento', () => {
    const event = { breadcrumbs: [{ category: 'navigation', data: { from: '/s/pipeline', to: '/s/ficha/Ab12' } }] };
    const crumb = scrubEvent(event).breadcrumbs[0];
    expect(crumb.data.to).toBe('/s/ficha/:leadId');
    expect(crumb.data.from).toBe('/s/pipeline');
  });

  it('limpa url.path e url.full no contexto da transação', () => {
    const event = {
      type: 'transaction',
      contexts: { trace: { data: { 'url.path': '/s/ficha/Ab12', 'url.full': 'https://stronilead.com.br/s/ficha/Ab12?invite=abc' } } }
    };
    const data = scrubEvent(event).contexts.trace.data;
    expect(data['url.path']).toBe('/s/ficha/:leadId');
    expect(data['url.full']).toBe('https://stronilead.com.br/s/ficha/:leadId');
  });

  it('limpa a descrição da span do documento', () => {
    const event = { type: 'transaction', spans: [{ op: 'browser.request', description: 'https://stronilead.com.br/s/ficha/Ab12?invite=abc' }] };
    expect(scrubEvent(event).spans[0].description).toBe('https://stronilead.com.br/s/ficha/:leadId');
  });

  it('não deixa sair o Referer, que numa aba aberta pela ficha leva o endereço dela', () => {
    const event = { request: { url: 'https://stronilead.com.br/s/pipeline', headers: { Referer: 'https://stronilead.com.br/s/ficha/Ab12', 'User-Agent': 'x' } } };
    expect(scrubEvent(event).request.headers).toEqual({ 'User-Agent': 'x' });
  });

  it('troca o id na mensagem da exceção e mantém os frames inteiros', () => {
    const event = {
      exception: {
        values: [{
          value: 'falhou ao abrir /s/ficha/Ab12 agora',
          stacktrace: { frames: [{ filename: 'https://stronilead.com.br/assets/index.js', function: 'abrir', lineno: 10 }] }
        }]
      }
    };
    const entry = scrubEvent(event).exception.values[0];
    expect(entry.value).toBe('falhou ao abrir /s/ficha/:leadId agora');
    expect(entry.stacktrace.frames[0]).toEqual({ filename: 'https://stronilead.com.br/assets/index.js', function: 'abrir', lineno: 10 });
  });

  it('mantém o slug da academia e as outras telas', () => {
    const event = { request: { url: 'https://stronilead.com.br/stronix-crm-app/leads/aulas' }, transaction: '/stronix-crm-app/pipeline' };
    const out = scrubEvent(event);
    expect(out.request.url).toBe('https://stronilead.com.br/stronix-crm-app/leads/aulas');
    expect(out.transaction).toBe('/stronix-crm-app/pipeline');
  });

  it('redige o seletor do LCP e do CLS e tira o token da foto do cliente', () => {
    const event = {
      type: 'transaction',
      contexts: {
        trace: {
          data: {
            'lcp.element': 'div > img[alt="Maria Souza"]',
            'lcp.url': 'https://firebasestorage.googleapis.com/v0/b/b/o/tenants%2Fs%2Fleads%2FAb12%2Favatar.jpg?alt=media&token=t',
            'cls.source.1': 'div.card > span[title="Maria Souza"]'
          }
        }
      }
    };
    const data = scrubEvent(event).contexts.trace.data;
    expect(data['lcp.element']).toBe('div > img[alt="[redigido]"]');
    expect(data['lcp.url']).toBe('https://firebasestorage.googleapis.com/v0/b/b/o/tenants%2Fs%2Fleads%2FAb12%2Favatar.jpg');
    expect(data['cls.source.1']).toBe('div.card > span[title="[redigido]"]');
  });
});

describe('scrubBreadcrumb: id do lead no endereço', () => {
  it('troca o id no destino da navegação e deixa a origem', () => {
    const crumb = { category: 'navigation', data: { from: '/s/pipeline', to: '/s/ficha/Ab12' } };
    const out = scrubBreadcrumb(crumb);
    expect(out.data.to).toBe('/s/ficha/:leadId');
    expect(out.data.from).toBe('/s/pipeline');
  });
});

describe('scrubSpan', () => {
  it('limpa a span do INP: nome do cliente no seletor e caminho da tela', () => {
    const span = { op: 'ui.interaction.click', description: 'body > div > span[title="Maria Souza"]', data: { transaction: '/s/ficha/Ab12' } };
    const out = scrubSpan(span);
    expect(out).toBe(span);
    expect(out.description).toBe('body > div > span[title="[redigido]"]');
    expect(out.data.transaction).toBe('/s/ficha/:leadId');
  });

  it('tira query e id da span que descreve uma URL', () => {
    const out = scrubSpan({ op: 'browser.request', description: 'https://stronilead.com.br/s/ficha/Ab12?invite=abc', data: { 'url.full': 'https://stronilead.com.br/s/ficha/Ab12?invite=abc' } });
    expect(out.description).toBe('https://stronilead.com.br/s/ficha/:leadId');
    expect(out.data['url.full']).toBe('https://stronilead.com.br/s/ficha/:leadId');
  });

  it('redige o seletor e a URL do LCP que vêm em span', () => {
    const out = scrubSpan({ op: 'ui.webvital.lcp', description: 'div > img[alt="Maria Souza"]', data: { 'lcp.element': 'img[alt="Maria Souza"]', 'lcp.url': 'https://x.com/a.jpg?token=t' } });
    expect(out.description).toBe('div > img[alt="[redigido]"]');
    expect(out.data['lcp.element']).toBe('img[alt="[redigido]"]');
    expect(out.data['lcp.url']).toBe('https://x.com/a.jpg');
  });

  it('devolve o que recebeu quando não é objeto', () => {
    expect(scrubSpan(null)).toBe(null);
    expect(scrubSpan(undefined)).toBe(undefined);
  });

  it('nunca devolve null nem lança: na falha sai uma casca sem descrição e sem data', () => {
    const span = {
      span_id: 's1',
      trace_id: 't1',
      op: 'ui.interaction.click',
      get description() { throw new Error('boom'); }
    };
    const out = scrubSpan(span);
    expect(out).toEqual({ span_id: 's1', trace_id: 't1', op: 'ui.interaction.click', description: '[redigido]', data: {} });
  });
});
