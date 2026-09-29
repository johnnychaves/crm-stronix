// Envio de e-mail transacional pela API HTTP do Resend. Hoje só o código do
// "Esqueci a senha" usa. Sem biblioteca: é um POST com JSON e tempo limite por
// AbortController. Desenho em
// docs/superpowers/specs/2026-09-28-esqueci-a-senha-design.md.

const RESEND_URL = 'https://api.resend.com/emails';

// Remetente quando o MAIL_FROM não vem, ou vem vazio.
export const MAIL_FROM_PADRAO = 'Stronilead <nao-responda@stronilead.com.br>';

// Como o envio está nesta função:
// - resend: tem a chave e manda de verdade.
// - off: sem a chave em produção. Quem depende de e-mail fica desligado.
// - log: sem a chave fora de produção (Preview e vercel dev). O e-mail vai
//   inteiro para o log, código incluso, para testar sem mandar nada. O
//   Preview usa o Firebase de produção: teste só com conta de academia de teste.
export function mailStatus({ apiKey = process.env.RESEND_API_KEY, vercelEnv = process.env.VERCEL_ENV } = {}) {
  if (apiKey) return 'resend';
  return vercelEnv === 'production' ? 'off' : 'log';
}

// Manda o e-mail. Lança quando o Resend recusa, demora ou a rede cai: quem
// chama decide o que fazer. Tudo que vem de fora entra por deps, com o valor
// de verdade como padrão, para o teste não sair para a rede. Os 8 segundos
// cabem no tempo máximo da função.
export async function sendMail(msg, deps = {}) {
  const {
    apiKey = process.env.RESEND_API_KEY,
    from = process.env.MAIL_FROM,
    vercelEnv = process.env.VERCEL_ENV,
    timeoutMs = 8000,
    httpFetch = (...args) => fetch(...args),
    log = console,
  } = deps;
  const status = mailStatus({ apiKey, vercelEnv });

  if (status === 'off') throw new Error('Envio de e-mail desligado: falta RESEND_API_KEY');
  if (status === 'log') {
    log.info('E-mail não enviado (sem RESEND_API_KEY). O conteúdo vai aqui no log', {
      para: msg.to, assunto: msg.subject, texto: msg.text,
    });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let resp;
  try {
    resp = await httpFetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from?.trim() || MAIL_FROM_PADRAO,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error(`O Resend não respondeu em ${timeoutMs} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    let detalhe = '';
    try {
      const corpo = await resp.json();
      if (typeof corpo?.message === 'string') detalhe = `: ${corpo.message}`;
    } catch {
      // Corpo sem JSON: fica só o status.
    }
    throw new Error(`O Resend recusou o e-mail (${resp.status})${detalhe}`);
  }

  // O id acha o e-mail no painel do Resend quando alguém disser que o código
  // não chegou.
  try {
    const corpo = await resp.json();
    if (typeof corpo?.id === 'string') log.info('E-mail aceito pelo Resend', { resendId: corpo.id });
  } catch {
    // Corpo sem JSON: o Resend já aceitou o e-mail.
  }
}
