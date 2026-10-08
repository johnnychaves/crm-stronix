import { describe, it, expect } from 'vitest';
import { cpuUsage } from 'node:process';
import {
  maskSensitive, scrubDeep, isNoise, scrubEvent, stripQuery, scrubBreadcrumb,
  scrubLeadPath, scrubLeadPathsDeep, scrubSpan
} from '../sentryScrub.js';

// Chave inventada, no formato do Resend: re_, 8 caracteres, sublinhado e 24 caracteres.
const CHAVE_RESEND = `re_${'Ab3d'.repeat(2)}_${'Ef6g'.repeat(6)}`;

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

  it('mascara a chave do zap inteira mesmo com 11 dígitos seguidos no meio dela', () => {
    // Se o padrão de documento rodasse antes, os dígitos virariam [documento] e o
    // resto da chave sairia em claro.
    const chave = `szk_ab12345678901${'cd'.repeat(17)}e`; // 48 hex
    expect(maskSensitive(`erro com a chave ${chave} invalida`))
      .toBe('erro com a chave [chave] invalida');
  });

  it('mascara a chave do resend', () => {
    expect(maskSensitive(`erro com a chave ${CHAVE_RESEND} invalida`))
      .toBe('erro com a chave [chave] invalida');
  });

  it('mascara a chave do resend inteira mesmo com 11 dígitos seguidos no meio dela', () => {
    // Se o padrão de documento rodasse antes, os dígitos virariam [documento] e o
    // resto da chave sairia em claro.
    expect(maskSensitive('o Resend recusou re_12345678901_abcdefghijklmnopqrstuvwx agora'))
      .toBe('o Resend recusou [chave] agora');
  });

  it('só é chave do resend com 16 caracteres ou mais depois do re_', () => {
    expect(maskSensitive(`re_${'a'.repeat(16)}`)).toBe('[chave]');
    expect(maskSensitive(`re_${'a'.repeat(15)}`)).toBe(`re_${'a'.repeat(15)}`);
  });

  it('deixa como está o texto que só lembra a chave do resend', () => {
    // O re_ no fim de uma palavra (feature_, where_, pre_) não começa chave.
    const textos = [
      're_curta',
      'feature_flags_enabled_for_all',
      'where_clause_is_not_valid',
      'pre_renderizar_a_tela_inteira'
    ];
    for (const texto of textos) expect(maskSensitive(texto)).toBe(texto);
  });
});

// O padrão de e-mail de antes do limite de 64 caracteres na parte local. Em
// texto longo sem espaço ele levava tempo quadrático: 80 KB de "a.a.a." davam 10 s.
const EMAIL_QUADRATICO = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

// A lista PATTERNS do sentryScrub.js como estava antes do limite (commit 12cce77),
// na mesma ordem. Só o padrão de e-mail difere da lista do módulo. Quem mudar
// outro padrão lá muda aqui também: esta cópia prova que o limite não mudou o
// resultado de nenhum e-mail de verdade.
const PATTERNS_ANTES = [
  [/\bszk_[0-9a-f]{48}\b/g, '[chave]'],
  [/\bre_[A-Za-z0-9_]{16,}/g, '[chave]'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[cpf]'],
  [EMAIL_QUADRATICO, '[email]'],
  [/(^|[^\d\w])((?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4})(?!\d)/g, '$1[telefone]'],
  [/(^|[^\d])(\d{11})(?!\d)/g, '$1[documento]'],
];

function mascaraDeAntes(texto) {
  let out = texto;
  for (const [re, label] of PATTERNS_ANTES) out = out.replace(re, label);
  return out;
}

// Parte local de 64 caracteres, o máximo do padrão de e-mail, com ponto, mais,
// hífen e sublinhado.
const LOCAL_64 = `${('joao.silva+teste_ana-paula.' + 'abc_def-ghi.'.repeat(5)).slice(0, 63)}z`;

// E-mails de verdade: parte local de até 64 caracteres, domínio de um ou mais níveis.
const EMAILS = [
  'joao@academia.com.br',
  'joao.silva@academia.com.br',
  'maria+stronilead@gmail.com',
  'ana-paula@empresa.co',
  'carlos_souza@exemplo.org',
  'a@b.co',
  'JOAO.SILVA@ACADEMIA.COM.BR',
  'financeirostronix@gmail.com',
  'nao-responda@stronilead.com.br',
  'recepcao.unidade-2@stronix.com.br',
  'contato@sub.dominio.exemplo.com.br',
  'aluno@mail.unidade-1.academia.gov.br',
  '11987654321@academia.com.br',
  '12345678901@academia.com.br',
  'o.nome.bem.comprido+tag_2026-09@dominio-com-hifen.example.museum',
  `${LOCAL_64}@academia.com.br`,
  `${'a'.repeat(64)}@x.co`
];

// Onde o e-mail aparece: colado em pontuação, em URL, em JSON, numa pilha de erro
// e perto de telefone e de CPF. Nenhum contexto cola letra, número, ponto, mais
// ou hífen antes do e-mail, porque aí a parte local passaria de 64 caracteres.
const CONTEXTOS = [
  (e) => e,
  (e) => `falha para ${e}`,
  (e) => `contato: ${e}.`,
  (e) => `${e}!`,
  (e) => `${e}, maria@x.com`,
  (e) => `(${e})`,
  (e) => `"${e}"`,
  (e) => `'${e}'`,
  (e) => `<${e}>`,
  (e) => `[${e}]`,
  (e) => `Ana Souza <${e}>`,
  (e) => `email=${e};`,
  (e) => `\t${e}\n`,
  (e) => `mailto:${e}`,
  (e) => `https://stronilead.com.br/convite?email=${e}&t=academia`,
  (e) => `https://stronilead.com.br/u/${e}/perfil`,
  (e) => JSON.stringify({ email: e, nome: 'Ana' }),
  (e) => `{"lead":{"email":"${e}","whatsapp":"(11) 98765-4321"}}`,
  (e) => `Error: auth/email-already-exists (${e})\n    at createUser (file:///var/task/api/_auth.js:80:19)`,
  (e) => `${e} (11) 98765-4321`,
  (e) => `${e} 123.456.789-01`,
  (e) => `tel 11987654321, e-mail ${e}, cpf 12345678901`,
  (e) => `123.456.789-01,${e}`,
  (e) => `(11) 98765-4321/${e}`,
  (e) => `${e}11987654321`
];

const VARIOS_EMAILS = [
  'a@x.com b@y.com c@z.com.br',
  'cc: joao@academia.com.br, maria@gmail.com; ana-paula@empresa.co',
  'de joao.silva@academia.com.br para financeirostronix@gmail.com em 28/09',
  '["joao@x.com","maria@y.com","ana@z.org"]',
  'joao@x.com,maria@y.com;ana@z.org',
  'joao@x.com+maria@y.com',
  'joao@x.com.maria@y.com',
  'a@b.c--@x.y',
  `${LOCAL_64}@x.com ${LOCAL_64}@y.com.br`
];

const PERTO_DE_NUMEROS = [
  'joao@x.com (11) 98765-4321 123.456.789-01 12345678901',
  'whatsapp +55 11 98765-4321, e-mail joao@x.com',
  '123.456.789-01@academia.com.br',
  'joao11987654321@academia.com.br',
  'joao.11987654321@academia.com.br',
  '11987654321.joao@academia.com.br',
  'tel:11987654321,mailto:joao@x.com',
  '5511987654321@s.whatsapp.net',
  '120363025246125888@g.us'
];

// Texto que não é e-mail, mas quase. Inclui o arroba largo (U+FF20), a parte
// local começando com ponto, mais ou hífen, e hífens ou pontos antes do @ que
// não contam como parte local, porque o padrão começa na primeira letra.
const QUASE_EMAIL = [
  '',
  '@',
  'a@b',
  '@x.com',
  'a@.com',
  'a@x.',
  'user@localhost',
  'joao\uFF20academia.com.br',
  '.joao@x.com',
  '-joao@x.com',
  '+joao@x.com',
  '..joao@x.com',
  '-.-joao@x.com',
  'joao.@x.com',
  '.@x.com',
  '-@x.com',
  '@@x.com',
  'joao@@x.com',
  'joao@-x.com',
  'joao@x.-com',
  'joao@x..com',
  'joao @ x.com',
  'joao@ x.com',
  'joao (at) x.com',
  'joão@academia.com.br',
  'joao@acadêmia.com.br',
  '"joao silva"@x.com',
  'git@github.com:stronix/crm.git',
  'https://usuario:senha@host.com.br/caminho',
  'logo@2x.png',
  'npm i @sentry/react@10.69.0',
  'Olá @maria, veja o #123',
  `${'-'.repeat(70)}joao@x.com`,
  `${'.'.repeat(80)}@x.com`
];

// Texto longo sem espaço, como uma URL enorme ou um JSON colado numa mensagem de
// erro. Com o padrão quadrático, cada um destes levava de 2 s a 31 s.
const A_PONTO = 'a.'.repeat(40000);
const TEXTOS_LONGOS = [
  ['"a." repetido até 80 KB', A_PONTO],
  ['o mesmo texto e um @ no fim', `${A_PONTO}@`],
  ['o mesmo texto e o arroba largo (U+FF20) no fim', `${A_PONTO}\uFF20`],
  ['muitos pontos seguidos entre as letras', `a${'.'.repeat(9)}`.repeat(8000)],
  ['um @ no meio seguido de 80 KB sem ponto', `${A_PONTO}@${'b'.repeat(80000)}`],
  ['um @ no meio seguido de 80 KB de pontos no domínio', `${A_PONTO}@b${'.'.repeat(80000)}`]
];

// Tempo de CPU, e não de relógio. Com a máquina ocupada, como no CI, que roda
// vários arquivos de teste ao mesmo tempo, o relógio de um caso de 35 ms chegou
// a 370 ms, enquanto a CPU gasta ficou em 40 ms.
function msDeCpu(fn) {
  const inicio = cpuUsage();
  fn();
  const { user, system } = cpuUsage(inicio);
  return (user + system) / 1000;
}

describe('maskSensitive: padrão de e-mail', () => {
  it('mascara cada e-mail de verdade inteiro, como antes', () => {
    expect(LOCAL_64).toHaveLength(64);
    for (const email of EMAILS) {
      expect(mascaraDeAntes(email), email).toBe('[email]');
      expect(maskSensitive(email), email).toBe('[email]');
    }
  });

  it('dá o mesmo resultado de antes com o e-mail em cada contexto', () => {
    for (const email of EMAILS) {
      for (const contexto of CONTEXTOS) {
        const texto = contexto(email);
        expect(maskSensitive(texto), texto).toBe(mascaraDeAntes(texto));
      }
    }
  });

  it('dá o mesmo resultado de antes com vários e-mails e com telefone e CPF por perto', () => {
    for (const texto of [...VARIOS_EMAILS, ...PERTO_DE_NUMEROS]) {
      expect(maskSensitive(texto), texto).toBe(mascaraDeAntes(texto));
    }
  });

  it('dá o mesmo resultado de antes no texto que quase é e-mail', () => {
    for (const texto of QUASE_EMAIL) {
      expect(maskSensitive(texto), texto).toBe(mascaraDeAntes(texto));
    }
  });

  it('só muda o resultado com parte local acima de 64 caracteres, que o padrão de e-mail não permite', () => {
    // Colado num prefixo longo, o e-mail continua mascarado e só o que passa de
    // 64 caracteres antes do @ fica como está. Sem começo de palavra nos 64
    // caracteres antes do @, nada é mascarado.
    const colado = 'relatorio-exportado-da-academia-stronix-em-2026-09-28-contato-joao.silva@academia.com.br';
    expect(mascaraDeAntes(colado)).toBe('[email]');
    expect(maskSensitive(colado)).toBe('relatorio[email]');
    const semComeco = `${'a'.repeat(65)}@academia.com.br`;
    expect(mascaraDeAntes(semComeco)).toBe('[email]');
    expect(maskSensitive(semComeco)).toBe(semComeco);
  });

  it.each(TEXTOS_LONGOS)('leva menos de 200 ms de CPU com %s', (_nome, texto) => {
    expect(msDeCpu(() => maskSensitive(texto))).toBeLessThan(200);
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

  it('mascara a chave do resend na mensagem, na pilha, na migalha e nos dados extras', () => {
    const event = {
      message: `envio falhou com ${CHAVE_RESEND}`,
      exception: {
        values: [{
          value: `Error: O Resend recusou a chave ${CHAVE_RESEND}\n    at sendMail (file:///var/task/api/_mail.js:80:19)`
        }]
      },
      breadcrumbs: [{
        category: 'console',
        message: `Error: 401 Bearer ${CHAVE_RESEND}`,
        data: { arguments: [`Bearer ${CHAVE_RESEND}`] }
      }],
      extra: { envio: { authorization: `Bearer ${CHAVE_RESEND}` } }
    };
    const out = scrubEvent(event);
    expect(out.message).toBe('envio falhou com [chave]');
    // Só a chave sai: o resto da pilha continua como estava.
    expect(out.exception.values[0].value)
      .toBe('Error: O Resend recusou a chave [chave]\n    at sendMail (file:///var/task/api/_mail.js:80:19)');
    expect(out.breadcrumbs[0].message).toBe('Error: 401 Bearer [chave]');
    expect(out.breadcrumbs[0].data.arguments).toEqual(['Bearer [chave]']);
    expect(out.extra.envio.authorization).toBe('Bearer [chave]');
    expect(JSON.stringify(out)).not.toContain(CHAVE_RESEND);
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

  it('mascara a chave do resend na migalha antes de ela entrar no evento', () => {
    const crumb = { category: 'console', message: `falhou com ${CHAVE_RESEND}`, data: { arguments: [`Bearer ${CHAVE_RESEND}`] } };
    const out = scrubBreadcrumb(crumb);
    expect(out.message).toBe('falhou com [chave]');
    expect(out.data.arguments).toEqual(['Bearer [chave]']);
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

  it('o id do modelo de rotina também sai do endereço', () => {
    expect(scrubLeadPath('/s/rotinas/modelos/AbC123')).toBe('/s/rotinas/modelos/:modelId');
    expect(scrubLeadPath('/s/rotinas/modelos/AbC123?x=1')).toBe('/s/rotinas/modelos/:modelId?x=1');
    expect(scrubLeadPath('/s/rotinas/hoje')).toBe('/s/rotinas/hoje');
    expect(scrubLeadPath('/s/rotinas/modelos')).toBe('/s/rotinas/modelos');
    expect(scrubLeadPath('https://x.com/s/ficha/L1 e /s/rotinas/modelos/M9')).toBe('https://x.com/s/ficha/:leadId e /s/rotinas/modelos/:modelId');
    expect(scrubLeadPath(scrubLeadPath('/s/rotinas/modelos/M9'))).toBe('/s/rotinas/modelos/:modelId');
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

  it('varredura final que lança não descarta o evento, e o que as camadas de cima limparam continua limpo', () => {
    const event = {
      // Primeira chave de propósito: a rede final estoura antes de qualquer
      // campo, então o que sobra no evento é só o trabalho das camadas de cima.
      contexts: { runtime: { get name() { throw new Error('boom'); } } },
      message: 'falhou para joao.silva@academia.com.br',
      request: {
        url: 'https://stronilead.com.br/stronix-crm-app/pipeline?invite=abc&phone=5511987654321',
        data: { cpf: '123.456.789-01' },
        cookies: { sessao: 'x' },
        query_string: 'invite=abc',
        headers: { Referer: 'https://stronilead.com.br/s/ficha/Ab12', 'User-Agent': 'x' }
      }
    };
    const out = scrubEvent(event);
    expect(out).toBe(event);
    expect(out.request.url).toBe('https://stronilead.com.br/stronix-crm-app/pipeline');
    expect(out.request.data).toBeUndefined();
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.query_string).toBeUndefined();
    expect(out.request.headers).toEqual({ 'User-Agent': 'x' });
    expect(out.message).toBe('falhou para [email]');
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

  it('a query de filtro não chega ao Sentry, nem na URL, nem na migalha, nem em url.path', () => {
    // A entrega 2 pôs id de colega e id de funil na query. Pela régua do
    // projeto, id que identifica uma pessoa tem o mesmo peso do id do lead.
    const q = '?pessoa=uid-do-colega&resp=uid1,uid2&funil=f2';
    const event = {
      request: { url: `https://stronilead.com.br/stronix-crm-app/clientes${q}` },
      contexts: { trace: { data: { 'url.path': `/stronix-crm-app/clientes${q}` } } },
    };
    const out = scrubEvent(event);
    expect(out.request.url).toBe('https://stronilead.com.br/stronix-crm-app/clientes');
    expect(out.contexts.trace.data['url.path']).toBe('/stronix-crm-app/clientes');
    const crumb = scrubBreadcrumb({ category: 'navigation', data: { from: '/stronix-crm-app/pipeline', to: `/stronix-crm-app/leads${q}` } });
    expect(crumb.data.to).toBe('/stronix-crm-app/leads');
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
