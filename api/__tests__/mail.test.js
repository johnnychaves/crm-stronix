import { describe, it, expect, vi } from 'vitest';
import { sendMail, mailStatus, MAIL_FROM_PADRAO } from '../_mail.js';

const MSG = { to: 'ana@academia.com', subject: 'Assunto', html: '<p>oi</p>', text: 'oi 123456' };
const log = () => ({ info: vi.fn() });
// Um envio que chega ao Resend: com chave, em produção. O teste troca só o que interessa.
const deps = (extra) => ({ apiKey: 're_x', vercelEnv: 'production', log: log(), ...extra });

// Resposta cujo corpo nunca chega: o json() só rejeita quando o sinal aborta.
const corpoTravado = ({ ok, status }) => async (_url, init) => {
  const { signal } = init;
  return {
    ok,
    status,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortado')));
    }),
  };
};

describe('mailStatus', () => {
  it('com a chave manda; sem a chave, só Preview e desenvolvimento vão para o log e o resto desliga', () => {
    expect(mailStatus({ apiKey: 're_x', vercelEnv: 'production' })).toBe('resend');
    expect(mailStatus({ apiKey: '', vercelEnv: 'production' })).toBe('off');
    expect(mailStatus({ apiKey: '', vercelEnv: 'preview' })).toBe('log');
    expect(mailStatus({ apiKey: '', vercelEnv: 'development' })).toBe('log');
    expect(mailStatus({ apiKey: '', vercelEnv: '' })).toBe('off');
    expect(mailStatus({ apiKey: '', vercelEnv: 'staging' })).toBe('off');
  });

  it('sem VERCEL_ENV no ambiente, desliga em vez de ir para o log', () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    try {
      expect(mailStatus({ apiKey: '' })).toBe('off');
      expect(mailStatus({ apiKey: '', vercelEnv: undefined })).toBe('off');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('chave só com espaços conta como sem chave', () => {
    expect(mailStatus({ apiKey: '   ', vercelEnv: 'production' })).toBe('off');
    expect(mailStatus({ apiKey: '   ', vercelEnv: 'preview' })).toBe('log');
    expect(mailStatus({ apiKey: '  re_x  ', vercelEnv: 'production' })).toBe('resend');
  });
});

describe('sendMail', () => {
  it('monta o pedido do Resend e registra o id aceito', async () => {
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'email-1' }) }));
    const l = log();
    await sendMail(MSG, { apiKey: 're_x', from: '', vercelEnv: 'production', httpFetch, log: l });
    const [url, init] = httpFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    // O módulo manda um Headers, que lista os nomes em minúsculas.
    expect(Object.fromEntries(init.headers)).toEqual({ authorization: 'Bearer re_x', 'content-type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      from: MAIL_FROM_PADRAO, to: ['ana@academia.com'], subject: 'Assunto', html: '<p>oi</p>', text: 'oi 123456',
    });
    expect(l.info).toHaveBeenCalledWith('E-mail aceito pelo Resend', { resendId: 'email-1' });
  });

  it('usa o MAIL_FROM quando vem preenchido', async () => {
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    await sendMail(MSG, { apiKey: 're_x', from: 'Outro <x@stronilead.com.br>', vercelEnv: 'production', httpFetch, log: log() });
    expect(JSON.parse(httpFetch.mock.calls[0][1].body).from).toBe('Outro <x@stronilead.com.br>');
  });

  it('recusa do Resend vira erro com o status e a mensagem', async () => {
    const httpFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: 'domínio não verificado' }) });
    await expect(sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log() }))
      .rejects.toThrow('O Resend recusou o e-mail (422): domínio não verificado');
  });

  it('demora vira erro com o tempo limite', async () => {
    const httpFetch = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('abortado')));
    });
    await expect(sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log(), timeoutMs: 20 }))
      .rejects.toThrow('O Resend não respondeu em 20 ms');
  });

  it('desligado, lança sem chamar o Resend', async () => {
    const httpFetch = vi.fn();
    await expect(sendMail(MSG, { apiKey: '', vercelEnv: 'production', httpFetch, log: log() }))
      .rejects.toThrow('Envio de e-mail desligado');
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('no modo log, escreve o e-mail no log e não chama o Resend', async () => {
    const httpFetch = vi.fn();
    const l = log();
    await sendMail(MSG, { apiKey: '', vercelEnv: 'preview', httpFetch, log: l });
    expect(httpFetch).not.toHaveBeenCalled();
    expect(l.info.mock.calls[0][1]).toEqual({ para: 'ana@academia.com', assunto: 'Assunto', texto: 'oi 123456' });
  });

  it('chave com caractere inválido vira erro fixo, sem repetir a chave, e não chama o Resend', async () => {
    const httpFetch = vi.fn();
    const erro = await sendMail(MSG, { apiKey: 're_abc\ndef', vercelEnv: 'production', httpFetch, log: log() })
      .then(() => null, (e) => e);
    expect(erro).toBeInstanceOf(Error);
    // Diz qual variável arrumar, sem repetir nada do valor dela.
    expect(erro.message).toContain('RESEND_API_KEY');
    expect(erro.message).not.toContain('re_abc');
    expect(erro.message).not.toContain('def');
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('o tempo limite vale até o fim do corpo: aceito com corpo travado resolve ao estourar', async () => {
    const httpFetch = corpoTravado({ ok: true, status: 200 });
    await expect(sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log(), timeoutMs: 30 }))
      .resolves.toBeUndefined();
  }, 1000);

  it('o tempo limite vale até o fim do corpo: recusa com corpo travado rejeita com o status ao estourar', async () => {
    const httpFetch = corpoTravado({ ok: false, status: 500 });
    await expect(sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log(), timeoutMs: 30 }))
      .rejects.toThrow('O Resend recusou o e-mail (500)');
  }, 1000);

  it('a recusa leva o status do Resend no erro, com a mesma mensagem', async () => {
    const httpFetch = async () => ({ ok: false, status: 422, json: async () => ({ message: 'domínio não verificado' }) });
    await expect(sendMail(MSG, deps({ httpFetch })))
      .rejects.toMatchObject({ status: 422, message: 'O Resend recusou o e-mail (422): domínio não verificado' });
  });

  it('espaço nas pontas da chave não vai para o cabeçalho', async () => {
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    await sendMail(MSG, deps({ apiKey: '  re_x  ', httpFetch }));
    expect(httpFetch.mock.calls[0][1].headers.get('authorization')).toBe('Bearer re_x');
  });

  it('chave só com espaços em produção desliga o envio, sem chamar o Resend', async () => {
    const httpFetch = vi.fn();
    await expect(sendMail(MSG, deps({ apiKey: '   ', httpFetch })))
      .rejects.toThrow('Envio de e-mail desligado');
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('queda de rede lança o erro original, sem virar sucesso nem mensagem de tempo limite', async () => {
    const queda = new TypeError('fetch failed');
    const httpFetch = async () => { throw queda; };
    await expect(sendMail(MSG, deps({ httpFetch }))).rejects.toBe(queda);
  });

  it('nenhum timer sobra depois do envio, em qualquer caminho', async () => {
    vi.useFakeTimers();
    try {
      const caminhos = {
        aceito: async () => ({ ok: true, status: 200, json: async () => ({ id: 'x' }) }),
        recusa: async () => ({ ok: false, status: 500, json: async () => ({}) }),
        rede: async () => { throw new TypeError('fetch failed'); },
        sincrono: () => { throw new Error('boom'); },
      };
      for (const [nome, httpFetch] of Object.entries(caminhos)) {
        await sendMail(MSG, deps({ httpFetch })).catch(() => {});
        expect(vi.getTimerCount(), nome).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('MAIL_FROM só com espaços cai no remetente padrão', async () => {
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    await sendMail(MSG, deps({ from: '   ', httpFetch }));
    expect(JSON.parse(httpFetch.mock.calls[0][1].body).from).toBe(MAIL_FROM_PADRAO);
  });

  it('o tempo limite padrão é de 8 s', async () => {
    vi.useFakeTimers();
    try {
      const httpFetch = (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('abortado')));
      });
      const envio = sendMail(MSG, { apiKey: 're_x', vercelEnv: 'production', httpFetch, log: log() });
      const pego = envio.catch((e) => e);
      await vi.advanceTimersByTimeAsync(7999);
      let acabou = false;
      pego.then(() => { acabou = true; });
      await Promise.resolve();
      expect(acabou).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pego).message).toBe('O Resend não respondeu em 8000 ms');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('variáveis de ambiente', () => {
  it('sem deps, lê RESEND_API_KEY, MAIL_FROM e VERCEL_ENV do ambiente', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_do_ambiente');
    vi.stubEnv('MAIL_FROM', 'Ambiente <a@stronilead.com.br>');
    vi.stubEnv('VERCEL_ENV', 'production');
    const httpFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    try {
      expect(mailStatus()).toBe('resend');
      await sendMail(MSG, { httpFetch, log: log() });
      const [, init] = httpFetch.mock.calls[0];
      expect(init.headers.get('authorization')).toBe('Bearer re_do_ambiente');
      expect(JSON.parse(init.body).from).toBe('Ambiente <a@stronilead.com.br>');
      vi.stubEnv('RESEND_API_KEY', '');
      expect(mailStatus()).toBe('off');
      vi.stubEnv('VERCEL_ENV', 'preview');
      expect(mailStatus()).toBe('log');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
