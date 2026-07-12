// Testes de CARACTERIZAÇÃO da busca global (globalSearch.js). Congelam o
// comportamento ATUAL: normalização 1-char-para-1-char (índices do trecho
// encontrado valem no nome original), tiers de match (0 = prefixo de token
// do nome, 1 = substring do nome, 2 = dígitos do telefone, 3 = dígitos do
// CPF), ordenação por tier + nome (pt-BR) e limite de resultados.
// A PR F (searchPeopleRemote) precisa reproduzir exatamente este ranking.

import { describe, it, expect } from 'vitest';
import { onlyDigits, normalize, searchPeople } from '../globalSearch.js';

// Helper de lead: objeto simples só com os campos que a busca lê.
let seq = 0;
const lead = (over = {}) => ({
  id: over.id || `l${++seq}`,
  name: 'Lead Teste',
  whatsapp: '',
  cpf: '',
  ...over
});

describe('onlyDigits', () => {
  it('extrai só os dígitos de um telefone formatado', () => {
    expect(onlyDigits('(11) 98765-4321')).toBe('11987654321');
    expect(onlyDigits('123.456.789-00')).toBe('12345678900');
  });

  it('entrada sem dígitos vira string vazia', () => {
    expect(onlyDigits('abc-def')).toBe('');
  });

  it('null/undefined/vazio viram string vazia', () => {
    expect(onlyDigits(null)).toBe('');
    expect(onlyDigits(undefined)).toBe('');
    expect(onlyDigits('')).toBe('');
  });

  it('aceita número e converte para string de dígitos', () => {
    expect(onlyDigits(11987654321)).toBe('11987654321');
  });

  it('COMPORTAMENTO ATUAL: o número 0 é falsy e vira "" (String(s || ""))', () => {
    expect(onlyDigits(0)).toBe('');
  });
});

describe('normalize', () => {
  it('minúsculas e sem acento: "João" → "joao"', () => {
    expect(normalize('João')).toBe('joao');
  });

  it('remove cedilha e acentos compostos: "Conceição" → "conceicao"', () => {
    expect(normalize('Conceição')).toBe('conceicao');
  });

  it('preserva o tamanho char a char (índices do original valem no normalizado)', () => {
    const original = 'João Ávila Conceição';
    const norm = normalize(original);
    expect(norm).toBe('joao avila conceicao');
    expect(norm.length).toBe(original.length);
  });

  it('não mexe em espaços nem pontuação', () => {
    expect(normalize('  Ana-Maria  ')).toBe('  ana-maria  ');
  });

  it('null/undefined/vazio viram string vazia', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize('')).toBe('');
  });
});

describe('searchPeople — ativação da busca (mínimos de tamanho)', () => {
  const base = [
    lead({ id: 'a', name: 'Ana Silva', whatsapp: '(11) 91234-5678', cpf: '123.456.789-00' })
  ];

  it('query vazia ou só espaços não busca nada', () => {
    expect(searchPeople(base, '')).toEqual({ results: [], total: 0 });
    expect(searchPeople(base, '   ')).toEqual({ results: [], total: 0 });
    expect(searchPeople(base, null)).toEqual({ results: [], total: 0 });
    expect(searchPeople(base, undefined)).toEqual({ results: [], total: 0 });
  });

  it('1 caractere não dispara busca por nome (mínimo é 2)', () => {
    expect(searchPeople(base, 'a')).toEqual({ results: [], total: 0 });
  });

  it('2 caracteres já disparam busca por nome', () => {
    const { results, total } = searchPeople(base, 'an');
    expect(total).toBe(1);
    expect(results[0].matchKind).toBe('name');
  });

  it('2 dígitos NÃO disparam busca por telefone/CPF (mínimo é 3 dígitos)', () => {
    // "91" está no telefone, mas com só 2 dígitos a camada de dígitos fica
    // desligada — e "91" também não aparece no nome.
    expect(searchPeople(base, '91')).toEqual({ results: [], total: 0 });
  });

  it('3 dígitos disparam busca por telefone', () => {
    const { results, total } = searchPeople(base, '912');
    expect(total).toBe(1);
    expect(results[0].matchKind).toBe('phone');
  });

  it('a query é trimada antes da busca por nome', () => {
    const { total } = searchPeople(base, '  ana  ');
    expect(total).toBe(1);
  });
});

describe('searchPeople — tiers de match e ranking', () => {
  it('prefixo de PRIMEIRO nome é tier 0 e vem antes de substring no meio (tier 1)', () => {
    const leads = [
      lead({ id: 'meio', name: 'Mariana Costa' }), // 'ana' dentro de 'mariana' → tier 1
      lead({ id: 'prefixo', name: 'Ana Silva' })   // token começa com 'ana' → tier 0
    ];
    const { results, total } = searchPeople(leads, 'ana');
    expect(total).toBe(2);
    expect(results.map((r) => r.lead.id)).toEqual(['prefixo', 'meio']);
    expect(results[0].matchKind).toBe('name');
    expect(results[0].matchRange).toEqual([0, 3]);
    // tier 1: posição da substring no nome normalizado ('mariana' → 'ana' no índice 4)
    expect(results[1].matchKind).toBe('name');
    expect(results[1].matchRange).toEqual([4, 7]);
  });

  it('prefixo de SOBRENOME também é tier 0, com range apontando pro token', () => {
    const leads = [lead({ id: 'c', name: 'Carlos Silva' })];
    const { results } = searchPeople(leads, 'silva');
    expect(results[0].matchKind).toBe('name');
    expect(results[0].matchRange).toEqual([7, 12]);
  });

  it('quando mais de um token bate, usa o PRIMEIRO token que começa com a query', () => {
    const leads = [lead({ id: 'dup', name: 'Ana Anastácia' })];
    const { results } = searchPeople(leads, 'ana');
    expect(results[0].matchRange).toEqual([0, 3]);
  });

  it('acha o token certo mesmo quando um token anterior é prefixo dele', () => {
    // tokens: 'silva' (pos 0) e 'silvano' (pos 6) — o acumulador de índice
    // garante que 'silvano' é localizado a partir do fim de 'silva'.
    const leads = [lead({ id: 's', name: 'Silva Silvano' })];
    const { results } = searchPeople(leads, 'silvano');
    expect(results[0].matchRange).toEqual([6, 13]);
  });

  it('match por telefone é tier 2: matchKind "phone" e matchRange null', () => {
    const leads = [lead({ id: 'p', name: 'Bruno Rocha', whatsapp: '(11) 98765-4321' })];
    const { results } = searchPeople(leads, '8765');
    expect(results[0].matchKind).toBe('phone');
    expect(results[0].matchRange).toBeNull();
  });

  it('match por CPF é tier 3: matchKind "cpf" e matchRange null', () => {
    const leads = [lead({ id: 'c', name: 'Bruno Rocha', cpf: '123.456.789-00' })];
    const { results } = searchPeople(leads, '456789');
    expect(results[0].matchKind).toBe('cpf');
    expect(results[0].matchRange).toBeNull();
  });

  it('telefone ganha do CPF quando os dígitos batem nos dois', () => {
    const leads = [
      lead({ id: 'x', name: 'Bruno Rocha', whatsapp: '11912345678', cpf: '123.456.789-00' })
    ];
    const { results } = searchPeople(leads, '123');
    expect(results[0].matchKind).toBe('phone');
  });

  it('match por nome ganha de match por telefone no MESMO lead', () => {
    const leads = [lead({ id: 'n', name: 'Loja 123', whatsapp: '123456789' })];
    const { results } = searchPeople(leads, '123');
    // qNorm '123' tem 2+ chars → a camada de nome roda primeiro; o token
    // '123' começa com a query → tier 0, e a camada de dígitos nem é testada.
    expect(results[0].matchKind).toBe('name');
    expect(results[0].matchRange).toEqual([5, 8]);
  });

  it('ordena por tier (0 → 1 → 2 → 3) e, dentro do tier, por nome pt-BR', () => {
    const leads = [
      lead({ id: 'cpf', name: 'Zeca Pagodinho', cpf: '111.222.333-44' }),
      lead({ id: 'fone', name: 'Yago Souza', whatsapp: '(11) 91112-2233' }),
      lead({ id: 'meio', name: 'Mariana Lima', whatsapp: '999' }),   // sem '112' → só entraria por nome
      lead({ id: 'pref-b', name: 'Bruna Anacleto' }),
      lead({ id: 'pref-a', name: 'Anacleto Dias' })
    ];
    // query 'ana': tier 0 = tokens que começam com 'ana' (Anacleto Dias e
    // Bruna Anacleto), tier 1 = 'ana' dentro de 'mariana'.
    const nome = searchPeople(leads, 'ana');
    expect(nome.results.map((r) => r.lead.id)).toEqual(['pref-a', 'pref-b', 'meio']);

    // query '1122': ninguém tem no nome; telefone (tier 2) vem antes de CPF (tier 3).
    const digitos = searchPeople(leads, '1122');
    expect(digitos.results.map((r) => r.lead.id)).toEqual(['fone', 'cpf']);
    expect(digitos.results.map((r) => r.matchKind)).toEqual(['phone', 'cpf']);
  });

  it('dentro do mesmo tier a ordem é alfabética (localeCompare pt-BR)', () => {
    const leads = [
      lead({ id: 'z', name: 'Ana Zurique' }),
      lead({ id: 'a', name: 'Ana Almeida' }),
      lead({ id: 'e', name: 'Ana Édouard' }) // acento não joga pro fim
    ];
    const { results } = searchPeople(leads, 'ana');
    expect(results.map((r) => r.lead.id)).toEqual(['a', 'e', 'z']);
  });
});

describe('searchPeople — acentos', () => {
  it('buscar "joao" (sem acento) acha "João Pedro"', () => {
    const leads = [lead({ id: 'j', name: 'João Pedro' })];
    const { results, total } = searchPeople(leads, 'joao');
    expect(total).toBe(1);
    expect(results[0].matchKind).toBe('name');
    expect(results[0].matchRange).toEqual([0, 4]);
  });

  it('buscar "joão" (com acento) acha "Joao Pedro" (sem acento no cadastro)', () => {
    const leads = [lead({ id: 'j', name: 'Joao Pedro' })];
    const { total } = searchPeople(leads, 'joão');
    expect(total).toBe(1);
  });

  it('busca é case-insensitive', () => {
    const leads = [lead({ id: 'j', name: 'joão pedro' })];
    expect(searchPeople(leads, 'JOÃO').total).toBe(1);
  });

  it('o range aponta pra posição no nome ORIGINAL mesmo com acento antes do token', () => {
    // 'José Almeida' → normalizado 'jose almeida' com o MESMO tamanho;
    // o token 'almeida' começa no índice 5 tanto no original quanto no normalizado.
    const leads = [lead({ id: 'j', name: 'José Almeida' })];
    const { results } = searchPeople(leads, 'alm');
    expect(results[0].matchRange).toEqual([5, 8]);
    expect('José Almeida'.slice(5, 8)).toBe('Alm');
  });
});

describe('searchPeople — telefone e CPF (dígitos parciais)', () => {
  const leads = [
    lead({ id: 'p1', name: 'Bruno Rocha', whatsapp: '(11) 98765-4321', cpf: '529.982.247-25' })
  ];

  it('dígitos parciais no meio do telefone batem', () => {
    expect(searchPeople(leads, '8765').results[0].matchKind).toBe('phone');
    expect(searchPeople(leads, '4321').results[0].matchKind).toBe('phone');
  });

  it('a query pode vir formatada — só os dígitos dela são comparados', () => {
    expect(searchPeople(leads, '(11) 9876').results[0].matchKind).toBe('phone');
    expect(searchPeople(leads, '987-65').results[0].matchKind).toBe('phone');
  });

  it('dígitos parciais do CPF batem quando não estão no telefone', () => {
    expect(searchPeople(leads, '529982').results[0].matchKind).toBe('cpf');
  });

  it('sequência de dígitos inexistente não acha nada', () => {
    expect(searchPeople(leads, '000000')).toEqual({ results: [], total: 0 });
  });
});

describe('searchPeople — limite e total', () => {
  const dez = Array.from({ length: 10 }, (_, i) =>
    lead({ id: `l${i}`, name: `Ana ${String.fromCharCode(65 + i)}` })
  );

  it('limite padrão é 8, mas total conta TODOS os matches', () => {
    const { results, total } = searchPeople(dez, 'ana');
    expect(results).toHaveLength(8);
    expect(total).toBe(10);
  });

  it('limite customizado corta os resultados (já ordenados)', () => {
    const { results, total } = searchPeople(dez, 'ana', { limit: 3 });
    expect(results).toHaveLength(3);
    expect(total).toBe(10);
    // ordenação alfabética acontece ANTES do corte
    expect(results.map((r) => r.lead.name)).toEqual(['Ana A', 'Ana B', 'Ana C']);
  });
});

describe('searchPeople — robustez do shape e entradas ruins', () => {
  it('cada result tem exatamente { lead, matchKind, matchRange } e lead é a MESMA referência', () => {
    const l = lead({ id: 'ref', name: 'Ana Silva' });
    const { results } = searchPeople([l], 'ana');
    expect(Object.keys(results[0]).sort()).toEqual(['lead', 'matchKind', 'matchRange']);
    expect(results[0].lead).toBe(l);
  });

  it('leads null/undefined não quebram (trata como lista vazia)', () => {
    expect(searchPeople(null, 'ana')).toEqual({ results: [], total: 0 });
    expect(searchPeople(undefined, 'ana')).toEqual({ results: [], total: 0 });
  });

  it('lead sem name/whatsapp/cpf não quebra e não entra no resultado', () => {
    const leads = [{ id: 'vazio' }, lead({ id: 'ok', name: 'Ana Silva' })];
    const { results, total } = searchPeople(leads, 'ana');
    expect(total).toBe(1);
    expect(results[0].lead.id).toBe('ok');
  });

  it('entrada null na lista não quebra', () => {
    const leads = [null, lead({ id: 'ok', name: 'Ana Silva' })];
    expect(searchPeople(leads, 'ana').total).toBe(1);
  });
});
