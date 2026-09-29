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

  it('nome com < ou & não quebra o HTML', () => {
    const { html } = buildResetEmail('<b>Ana</b> & Cia', '000001');
    expect(html).toContain('Olá, &lt;b&gt;Ana&lt;/b&gt;.');
    expect(html).not.toContain('<b>Ana');
  });

  it('sem nome, cumprimenta sem nome', () => {
    expect(buildResetEmail('', '000001').text.startsWith('Olá.')).toBe(true);
    expect(buildResetEmail(undefined, '000001').html).toContain('>Olá.<');
  });

  it('não tem travessão', () => {
    expect(email.html + email.text).not.toMatch(/[—–]/);
  });
});

describe('escapeHtml', () => {
  it('troca os cinco caracteres do HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
