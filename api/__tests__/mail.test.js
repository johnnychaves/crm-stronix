import { describe, it, expect, vi } from 'vitest';
import { sendMail, mailStatus, MAIL_FROM_PADRAO } from '../_mail.js';

const MSG = { to: 'ana@academia.com', subject: 'Assunto', html: '<p>oi</p>', text: 'oi 123456' };
const log = () => ({ info: vi.fn() });

describe('mailStatus', () => {
  it('com a chave manda; sem a chave, desliga em produção e vai para o log fora dela', () => {
    expect(mailStatus({ apiKey: 're_x', vercelEnv: 'production' })).toBe('resend');
    expect(mailStatus({ apiKey: '', vercelEnv: 'production' })).toBe('off');
    expect(mailStatus({ apiKey: '', vercelEnv: 'preview' })).toBe('log');
    expect(mailStatus({ apiKey: '', vercelEnv: '' })).toBe('log');
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
    expect(init.headers).toEqual({ Authorization: 'Bearer re_x', 'Content-Type': 'application/json' });
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
});
