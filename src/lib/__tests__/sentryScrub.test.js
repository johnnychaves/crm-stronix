import { describe, it, expect } from 'vitest';
import { maskSensitive, scrubDeep, isNoise, scrubEvent } from '../sentryScrub.js';

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
