import { RESET_CODE_TTL_MS, isResetCodeFormat } from '../src/lib/passwordReset.js';

// O e-mail com o código do "Esqueci a senha". Função pura: quem manda é o
// _mail.js. O HTML vai em tabela e com o estilo no próprio elemento, porque
// cliente de e-mail não lê CSS de fora e o Outlook ignora largura em div. Por
// isso as cores aparecem em hex. As da marca vêm do src/index.css: paper-50,
// paper-200, ink-900, brand-600, brand-50 e brand-700. Os dois cinzas do texto
// de apoio (#5B6477 e #687083) são próprios do e-mail. O do rodapé tem 4,6:1
// de contraste sobre o fundo, acima do mínimo de 4,5:1 para texto pequeno. A
// marca vai em texto porque cliente de e-mail costuma bloquear imagem.

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A saudação só leva a primeira palavra do nome quando ela é nome: começa com
// letra, segue com letras, apóstrofo ou hífen, e tem até 40 caracteres. O nome
// vem do cadastro da equipe, que o gestor digita, e um nome como
// "https://site-falso.com" viraria link clicável num e-mail oficial. O resto
// fica "Olá." sem nome.
const NAME_RE = /^\p{L}[\p{L}'’-]{0,39}$/u;

const firstName = (name) => {
  const first = String(name ?? '').trim().split(/\s+/)[0] || '';
  return NAME_RE.test(first) ? first : '';
};

export function buildResetEmail(name, code) {
  if (!isResetCodeFormat(code)) throw new Error('esqueci-a-senha: código inválido para o e-mail');
  const minutos = Math.round(RESET_CODE_TTL_MS / 60_000);
  const primeiro = firstName(name);
  // O código fica fora do assunto para não aparecer na tela bloqueada do celular.
  const subject = 'Seu código para criar uma senha nova no Stronilead';
  // A prévia da caixa de entrada também não leva o código. Ela sai do começo
  // do corpo, então um bloco escondido ocupa esse lugar com uma frase, e o
  // enchimento impede o cliente de completar a prévia com o resto do e-mail.
  // A frase é longa de propósito: sem o enchimento, o código ainda cai depois
  // do caractere 140.
  const previa = 'Abra o e-mail para ver o código. Se não foi você que pediu, pode ignorar este e-mail.';
  const enchimento = '&zwnj;&nbsp;'.repeat(48);
  const intro = 'Use este código para criar uma senha nova no Stronilead:';
  const aviso = `Ele vale por ${minutos} minutos. Se não foi você que pediu, ignore este e-mail. Sua senha atual continua valendo.`;
  const rodape = 'Stronilead · Gestão de leads para academias';

  const text = [
    primeiro ? `Olá, ${primeiro}.` : 'Olá.',
    '',
    intro,
    '',
    code,
    '',
    aviso,
    '',
    rodape,
  ].join('\n');

  const saudacao = primeiro ? `Olá, ${escapeHtml(primeiro)}.` : 'Olá.';
  const html = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    // O charset vale para o HTML aberto fora do cliente de e-mail, onde não
    // há cabeçalho MIME dizendo que é UTF-8.
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>`,
    '<body style="margin:0;padding:0;background:#F5F7FB;">',
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previa}${enchimento}</div>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F7FB;">',
    '<tr><td align="center" style="padding:32px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E3E6EE;border-radius:12px;">',
    '<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0E1A40;">',
    '<p style="margin:0 0 24px;font-size:20px;letter-spacing:-0.3px;">STRONI<span style="font-weight:700;color:#2B59FF;">LEAD</span></p>',
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${saudacao}</p>`,
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${intro}</p>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">',
    `<tr><td align="center" style="background:#EAF0FF;border-radius:10px;padding:16px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#1C3FC4;">${escapeHtml(code)}</td></tr>`,
    '</table>',
    `<p style="margin:0;font-size:14px;line-height:1.6;color:#5B6477;">${aviso}</p>`,
    '</td></tr>',
    '</table>',
    `<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#687083;">${rodape}</p>`,
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');

  return { subject, html, text };
}
