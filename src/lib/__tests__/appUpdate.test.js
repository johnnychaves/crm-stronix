// @vitest-environment jsdom
// Versão nova na volta da pausa. O Stronilead roda numa aba que fica aberta o
// dia inteiro, e o código só troca quando a página recarrega. Na volta de uma
// pausa de 15 minutos, o app pergunta ao servidor qual é a versão publicada
// (version.json, gerado no build) e recarrega quando ela é outra, desde que
// ninguém tenha deixado trabalho pela metade na tela.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { shouldReload, hasUnsavedWork, fetchRelease, RELOAD_MARK_KEY } from '../appUpdate.js';
import { useReloadOnUpdate } from '../../hooks/useReloadOnUpdate.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('shouldReload', () => {
  const base = { current: 'aaa111', remote: 'bbb222', triedFor: null, unsaved: false };

  it('recarrega quando a versão publicada é outra e a tela está livre', () => {
    expect(shouldReload(base)).toBe(true);
  });

  it.each([
    ['mesma versão', { remote: 'aaa111' }],
    ['servidor não respondeu', { remote: null }],
    ['build local, sem versão', { current: 'dev' }],
    ['sem versão no build', { current: undefined }],
    ['já recarregou por essa versão nesta aba', { triedFor: 'bbb222' }],
    ['trabalho pela metade na tela', { unsaved: true }],
  ])('não recarrega: %s', (_, mudanca) => {
    expect(shouldReload({ ...base, ...mudanca })).toBe(false);
  });
});

describe('hasUnsavedWork', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  const tela = (html) => { document.body.innerHTML = html; return document; };

  it('tela sem janela e sem texto digitado está livre', () => {
    expect(hasUnsavedWork(tela('<main><input type="text" value=""><textarea></textarea></main>'))).toBe(false);
  });

  it.each([
    ['janela aberta', '<div role="dialog"></div>'],
    ['confirmação aberta', '<div role="alertdialog"></div>'],
    ['anotação digitada', '<textarea>ligou e pediu horário</textarea>'],
    ['campo de texto preenchido', '<input value="Maria">'],
    ['telefone preenchido', '<input type="tel" value="(31) 9 7198-3969">'],
  ])('%s segura a recarga', (_, html) => {
    expect(hasUnsavedWork(tela(html))).toBe(true);
  });

  it.each([
    ['caixa de marcar', '<input type="checkbox" value="on" checked>'],
    ['campo escondido', '<input type="hidden" value="x">'],
    ['data', '<input type="date" value="2026-10-09">'],
    ['campo só de leitura', '<input value="fixo" readonly>'],
    ['campo desligado', '<input value="fixo" disabled>'],
    ['só espaços', '<textarea>   </textarea>'],
  ])('%s não conta como trabalho pela metade', (_, html) => {
    expect(hasUnsavedWork(tela(html))).toBe(false);
  });

  it('sem documento, na dúvida, segura', () => {
    expect(hasUnsavedWork(null)).toBe(true);
  });
});

describe('fetchRelease', () => {
  const resposta = (corpo, ok = true) => ({ ok, json: async () => (typeof corpo === 'string' ? JSON.parse(corpo) : corpo) });

  it('lê a versão do version.json, sem cache', async () => {
    const fetchImpl = vi.fn(async () => resposta({ release: 'bbb222' }));
    expect(await fetchRelease(fetchImpl)).toBe('bbb222');
    expect(fetchImpl).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }));
  });

  it.each([
    ['resposta de erro', async () => resposta({ release: 'x' }, false)],
    // Arquivo que não existe vira o index.html, com 200 (vercel.json).
    ['HTML no lugar do arquivo', async () => resposta('<!doctype html>')],
    ['versão vazia', async () => resposta({ release: '' })],
    ['sem rede', async () => { throw new TypeError('Failed to fetch'); }],
  ])('%s devolve null', async (_, fetchImpl) => {
    expect(await fetchRelease(fetchImpl)).toBeNull();
  });

  it('desiste depois do tempo limite', async () => {
    const fetchImpl = (url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    expect(await fetchRelease(fetchImpl, 10)).toBeNull();
  });
});

describe('useReloadOnUpdate', () => {
  let root = null;
  // O beforeResume que o hook devolve sai pelo efeito, depois do render.
  const saida = { antes: null };
  const antes = (resume) => saida.antes(resume);
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    document.body.innerHTML = '';
    root = null;
  });

  async function montar(opcoes) {
    function Sonda() {
      const beforeResume = useReloadOnUpdate(opcoes);
      useEffect(() => { saida.antes = beforeResume; });
      return null;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(h(Sonda)); });
  }
  const publicada = (release) => async () => ({ ok: true, json: async () => ({ release }) });

  it('versão nova com a tela livre: recarrega, não retoma e marca a versão', async () => {
    const reload = vi.fn();
    const resume = vi.fn();
    await montar({ current: 'aaa111', fetchImpl: publicada('bbb222'), reload });

    await antes(resume);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOAD_MARK_KEY)).toBe('bbb222');
  });

  it('mesma versão: só retoma', async () => {
    const reload = vi.fn();
    const resume = vi.fn();
    await montar({ current: 'aaa111', fetchImpl: publicada('aaa111'), reload });

    await antes(resume);

    expect(reload).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('versão nova com uma anotação pela metade: retoma e tenta na próxima volta', async () => {
    const reload = vi.fn();
    const resume = vi.fn();
    await montar({ current: 'aaa111', fetchImpl: publicada('bbb222'), reload });
    const nota = document.createElement('textarea');
    nota.value = 'retornar amanhã';
    document.body.appendChild(nota);

    await antes(resume);

    expect(reload).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_MARK_KEY)).toBeNull();
  });

  it('já recarregou por essa versão e continua na antiga: não recarrega de novo', async () => {
    sessionStorage.setItem(RELOAD_MARK_KEY, 'bbb222');
    const reload = vi.fn();
    const resume = vi.fn();
    await montar({ current: 'aaa111', fetchImpl: publicada('bbb222'), reload });

    await antes(resume);

    expect(reload).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('servidor fora do ar: retoma', async () => {
    const reload = vi.fn();
    const resume = vi.fn();
    await montar({ current: 'aaa111', fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, reload });

    await antes(resume);

    expect(reload).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
  });
});
