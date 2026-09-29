// @vitest-environment jsdom
// Os avisos das telas de entrada (login e "Esqueci a senha"). A região existe
// desde a montagem, vazia, porque o leitor de tela só anuncia o que aparece
// numa região que já estava na página.
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthAlert, AuthStatus } from '../../views/auth/AuthNotice.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;

// Monta na primeira chamada e redesenha no mesmo root nas seguintes, para o
// teste conferir que a região é o mesmo elemento antes e depois da mensagem.
async function montar(elemento) {
  if (!root) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => { root.render(elemento); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

// As classes que a caixa do erro e a do aviso já tinham no login, antes de
// virarem componente. O mb-4 não entra aqui: vem de quem usa, pelo className.
const CAIXA = {
  alert: 'flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300',
  status: 'flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300',
};

const classesDe = (el) => [...el.classList].sort();
const classes = (...trechos) => trechos.join(' ').split(' ').sort();

describe.each([
  ['AuthAlert', AuthAlert, 'alert'],
  ['AuthStatus', AuthStatus, 'status'],
])('%s', (_nome, Aviso, papel) => {
  const regiao = () => document.querySelector(`[role="${papel}"]`);

  it.each([['vazia', ''], ['ausente', undefined], ['nula', null]])('com a mensagem %s, a região fica na tela, escondida e sem ícone', async (_caso, message) => {
    await montar(h(Aviso, { message }));
    expect(regiao()).not.toBeNull();
    expect(regiao().textContent).toBe('');
    expect(classesDe(regiao())).toEqual(['sr-only']);
    expect(regiao().querySelector('svg')).toBeNull();
  });

  it('com mensagem, mostra a frase e o ícone na caixa colorida, sem sr-only', async () => {
    await montar(h(Aviso, { message: 'Uma frase de teste.' }));
    expect(regiao().textContent).toBe('Uma frase de teste.');
    expect(regiao().querySelector('svg')).not.toBeNull();
    expect(classesDe(regiao())).toEqual(classes(CAIXA[papel]));
  });

  it('é o mesmo elemento quando a mensagem chega e quando ela sai', async () => {
    await montar(h(Aviso, { message: '' }));
    const antes = regiao();
    await montar(h(Aviso, { message: 'Chegou.' }));
    expect(regiao()).toBe(antes);
    expect(antes.textContent).toBe('Chegou.');
    await montar(h(Aviso, { message: '' }));
    expect(regiao()).toBe(antes);
    expect(antes.textContent).toBe('');
    expect(classesDe(antes)).toEqual(['sr-only']);
  });

  it('o className só entra quando há mensagem', async () => {
    await montar(h(Aviso, { message: '', className: 'mb-4' }));
    expect(classesDe(regiao())).toEqual(['sr-only']);
    await montar(h(Aviso, { message: 'Com mensagem.', className: 'mb-4' }));
    expect(classesDe(regiao())).toEqual(classes(CAIXA[papel], 'mb-4'));
  });

  it('o id chega à região, com e sem mensagem', async () => {
    await montar(h(Aviso, { message: '', id: 'aviso-de-teste' }));
    expect(document.getElementById('aviso-de-teste')).toBe(regiao());
    await montar(h(Aviso, { message: 'Agora com frase.', id: 'aviso-de-teste' }));
    expect(document.getElementById('aviso-de-teste')).toBe(regiao());
  });
});

describe('os dois papéis', () => {
  it('o erro é alert e o aviso é status, e um não usa a cor do outro', async () => {
    await montar(h('div', null, h(AuthAlert, { message: 'Deu erro.' }), h(AuthStatus, { message: 'Deu certo.' })));
    const erro = document.querySelector('[role="alert"]');
    const aviso = document.querySelector('[role="status"]');
    expect(erro.textContent).toBe('Deu erro.');
    expect(aviso.textContent).toBe('Deu certo.');
    expect(erro.classList.contains('bg-rose-50')).toBe(true);
    expect(erro.classList.contains('bg-emerald-50')).toBe(false);
    expect(aviso.classList.contains('bg-emerald-50')).toBe(true);
    expect(aviso.classList.contains('bg-rose-50')).toBe(false);
  });
});
