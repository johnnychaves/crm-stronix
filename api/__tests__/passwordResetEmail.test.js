import { describe, it, expect } from 'vitest';
import { buildResetEmail, escapeHtml } from '../_passwordResetEmail.js';

describe('buildResetEmail', () => {
  const email = buildResetEmail('Ana Souza', '048213');

  it('o código fica fora do assunto', () => {
    expect(email.subject).toBe('Seu código para criar uma senha nova no Stronilead');
    expect(email.subject).not.toMatch(/\d/);
  });

  it('o HTML e o texto levam o código, o primeiro nome, a validade e o rodapé', () => {
    for (const corpo of [email.html, email.text]) {
      expect(corpo).toContain('048213');
      expect(corpo).toContain('Olá, Ana.');
      expect(corpo).toContain('Ele vale por 15 minutos.');
      expect(corpo).toContain('Stronilead · Gestão de leads para academias');
    }
    expect(email.html).toContain('STRONI<span');
    expect(email.html).toContain('#2B59FF');
    expect(email.html).toContain('#EAF0FF');
  });

  it('leva a frase de segurança inteira, no HTML e no texto', () => {
    for (const corpo of [email.html, email.text]) {
      expect(corpo).toContain('Se não foi você que pediu, ignore este e-mail.');
      expect(corpo).toContain('Sua senha atual continua valendo.');
    }
  });

  it('o código aparece no quadro do HTML', () => {
    expect(email.html).toMatch(/>048213<\/td>/);
  });

  it('o rodapé usa o cinza #687083, com contraste de 4,6:1 sobre o fundo', () => {
    expect(email.html).toMatch(/color:#687083;">Stronilead · Gestão de leads para academias<\/p>/);
  });

  it('declara o charset UTF-8 no head, antes do corpo', () => {
    expect(email.html).toContain('<meta charset="utf-8">');
    expect(email.html.indexOf('<meta charset="utf-8">')).toBeLessThan(email.html.indexOf('<body'));
  });

  it('declara o viewport e o título, que repete o assunto', () => {
    expect(email.html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(email.html).toContain(`<title>${email.subject}</title>`);
  });

  it('a prévia da caixa de entrada vem antes do código e não leva dígito', () => {
    const previa = email.html.match(/<div style="display:none[^"]*">([^<]*)<\/div>/);
    expect(previa).not.toBeNull();
    // Abre o corpo: é o primeiro texto que o cliente de e-mail lê.
    expect(email.html).toMatch(/<body[^>]*>\s*<div style="display:none/);
    expect(previa[1]).not.toMatch(/\d/);
    // A frase não repete o assunto, que a caixa de entrada já mostra ao lado dela.
    expect(previa[1].startsWith('Abra o e-mail para ver o código. Se não foi você que pediu, pode ignorar este e-mail.')).toBe(true);
    // Sem o mso-hide:all o Outlook pode mostrar o bloco no corpo do e-mail.
    expect(previa[0]).toContain('mso-hide:all');
    expect(email.html.indexOf(previa[0])).toBeLessThan(email.html.indexOf('048213'));
    // O enchimento impede o cliente de completar a prévia com o resto do corpo.
    expect((previa[1].match(/&zwnj;&nbsp;/g) ?? []).length).toBeGreaterThanOrEqual(48);
  });

  it('sem o enchimento, o código cai depois do caractere 140 da prévia', () => {
    // Alguns clientes descartam o enchimento. Mesmo assim, o código não pode
    // aparecer nos primeiros 140 caracteres do texto do corpo. Sem nome é o
    // pior caso, porque a saudação fica mais curta.
    const { html } = buildResetEmail('', '048213');
    const texto = html
      .slice(html.indexOf('<body'))
      .replace(/<[^>]*>/g, '')
      .replace(/(&zwnj;&nbsp;)+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    expect(texto.indexOf('048213')).toBeGreaterThan(140);
  });

  it('nome com < ou & não quebra o HTML: a primeira palavra não é nome, e a saudação fica sem ele', () => {
    const { html, text } = buildResetEmail('<b>Ana</b> & Cia', '000001');
    expect(html).toContain('>Olá.<');
    expect(text.startsWith('Olá.\n')).toBe(true);
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('&lt;b&gt;');
  });

  it('o texto puro não leva entidade HTML, o HTML leva', () => {
    const { html, text } = buildResetEmail("D'Ávila & Cia", '000001');
    expect(text).toContain("Olá, D'Ávila.");
    expect(text).not.toMatch(/&#?\w+;/);
    expect(html).toContain('Olá, D&#39;Ávila.');
  });

  it('pega o primeiro nome com espaço nas pontas, tab ou espaço não separável', () => {
    for (const nome of ['  Maria da Silva ', 'Maria\u00a0da Silva', 'Maria\tda Silva']) {
      expect(buildResetEmail(nome, '000001').text.startsWith('Olá, Maria.')).toBe(true);
    }
  });

  it('sem nome, cumprimenta sem nome', () => {
    expect(buildResetEmail('', '000001').text.startsWith('Olá.')).toBe(true);
    expect(buildResetEmail(undefined, '000001').html).toContain('>Olá.<');
  });

  it('sem nome útil (null, só espaços), cumprimenta sem nome', () => {
    for (const nome of [null, '   ', '\u00a0']) {
      expect(buildResetEmail(nome, '000001').text.startsWith('Olá.\n')).toBe(true);
    }
  });

  // O nome vem do cadastro da equipe, que o gestor digita, e vai num e-mail
  // oficial. Só uma primeira palavra que é nome entra na saudação.
  describe('quem entra na saudação', () => {
    // A saudação do HTML e a do texto, lado a lado.
    const saudacoes = (nome) => {
      const { html, text } = buildResetEmail(nome, '000001');
      return [html.match(/>(Olá[^<]*)<\/p>/)[1], text.split('\n')[0]];
    };

    it.each([
      ['nome comum', 'Ana Souza', 'Olá, Ana.'],
      ['nome com acento', 'João Pedro', 'Olá, João.'],
      ['nome com cedilha e til', 'Conceição', 'Olá, Conceição.'],
      ['nome com hífen', 'Ana-Maria Lopes', 'Olá, Ana-Maria.'],
      ['nome com apóstrofo curvo', 'D’Ávila', 'Olá, D’Ávila.'],
      ['nome de 40 letras', 'A'.repeat(40), `Olá, ${'A'.repeat(40)}.`],
    ])('%s entra: %s', (_caso, nome, esperado) => {
      expect(saudacoes(nome)).toEqual([esperado, esperado]);
    });

    it('nome com apóstrofo reto entra, e o HTML leva o apóstrofo com escape', () => {
      expect(saudacoes("D'Ávila")).toEqual(['Olá, D&#39;Ávila.', "Olá, D'Ávila."]);
    });

    it.each([
      ['endereço de site', 'https://site-falso.com Silva'],
      ['site sem o https', 'www.site-falso.com'],
      ['e-mail', 'ana@academia.com'],
      ['número', '123'],
      ['nome com número', 'Ana2 Souza'],
      ['palavra que começa com hífen', '-Ana'],
      ['palavra que começa com apóstrofo', "'Ana"],
      ['nome com ponto', 'Ana. Souza'],
      ['nome de 41 letras', 'A'.repeat(41)],
      ['nome vazio', ''],
    ])('%s fica de fora: "Olá." sem nome', (_caso, nome) => {
      expect(saudacoes(nome)).toEqual(['Olá.', 'Olá.']);
    });

    it('o endereço não aparece em lugar nenhum do e-mail', () => {
      const { html, text } = buildResetEmail('https://site-falso.com', '000001');
      expect(html + text).not.toContain('site-falso');
    });
  });

  it('tabelas de layout com role="presentation" e idioma declarado', () => {
    const tabelas = email.html.match(/<table\b[^>]*>/g) ?? [];
    expect(tabelas.length).toBeGreaterThan(0);
    for (const tabela of tabelas) expect(tabela).toContain('role="presentation"');
    expect(email.html).toContain('<html lang="pt-BR">');
  });

  it('recusa código que não são 6 números', () => {
    for (const codigo of ['12345', undefined, 123456]) {
      expect(() => buildResetEmail('Ana', codigo)).toThrow('esqueci-a-senha: código inválido para o e-mail');
    }
  });

  it('não tem travessão', () => {
    expect(email.html + email.text).not.toMatch(/[\u2014\u2013]/);
  });
});

describe('escapeHtml', () => {
  it('troca os cinco caracteres do HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
