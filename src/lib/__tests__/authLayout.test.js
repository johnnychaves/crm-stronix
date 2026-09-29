// @vitest-environment jsdom
// A moldura e o campo das telas de entrada (login e "Esqueci a senha").
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Lock } from 'lucide-react';
import { AuthLayout, AuthTenantChip } from '../../views/auth/AuthLayout.jsx';
import { AuthField, AuthInput, AuthPasswordToggle } from '../../views/auth/AuthField.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;

async function montar(elemento) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(elemento); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  document.body.innerHTML = '';
  root = null;
});

// O elemento sem filhos cujo texto é exatamente o dado.
const folhaComTexto = (texto) => [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent === texto);

// Um campo de senha como o da tela: o botão de mostrar fica dentro do campo e
// a tela liga o input à dica e ao erro pelo aria-describedby.
const campoDeSenha = (props) => h(AuthField, { label: 'Senha nova', icon: Lock, hint: 'Uma dica', hintId: 'dica', errorId: 'erro', ...props },
  h(AuthInput, { name: 'senha', type: 'password', 'aria-describedby': 'dica erro' }),
  h(AuthPasswordToggle, { shown: false, onToggle: () => {} }));

// O texto que o leitor de tela junta para uma lista de ids (aria-labelledby e aria-describedby).
const texto = (ids) => ids.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();

const caixaDoInput = () => document.querySelector('input[name="senha"]').parentElement;

describe('AuthLayout', () => {
  it('desenha o painel, o formulário e o rodapé', async () => {
    await montar(h(AuthLayout, null, h('form', { id: 'formulario' })));
    expect(document.getElementById('formulario')).not.toBeNull();
    expect(document.body.textContent).toContain('Transforme cada lead em matrícula.');
    expect(document.body.textContent).toContain('Conexão segura · STRONILEAD © 2026');
  });

  it('o texto do painel não tem travessão', async () => {
    await montar(h(AuthLayout, null, null));
    expect(document.body.textContent).toContain('Pipeline, meta diária e agendamentos num só lugar. Sua equipe focada no que importa: fechar.');
    expect(document.body.textContent).not.toMatch(/[—–]/);
  });

  it('a etiqueta mostra o nome da academia', async () => {
    await montar(h(AuthTenantChip, { name: 'Academia Teste' }));
    expect(document.body.textContent).toContain('Academia Teste');
  });

  it('o formulário fica dentro do main, o único da página', async () => {
    await montar(h(AuthLayout, null, h('form', { id: 'formulario' })));
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(document.getElementById('formulario').closest('main')).not.toBeNull();
  });

  it('a moldura não traz título, porque o h1 é da tela do formulário', async () => {
    await montar(h(AuthLayout, null, null));
    expect(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });

  it('os cartões de exemplo do painel ficam escondidos do leitor de tela', async () => {
    await montar(h(AuthLayout, null, null));
    for (const dado of ['1.284', 'Mariana Costa']) {
      const elemento = folhaComTexto(dado);
      expect(elemento, dado).toBeDefined();
      expect(elemento.closest('[aria-hidden="true"]'), dado).not.toBeNull();
    }
  });
});

describe('AuthField', () => {
  it('o nome do input é só o texto do rótulo, sem o botão que fica dentro do campo', async () => {
    await montar(campoDeSenha());
    const input = document.querySelector('input[name="senha"]');
    expect(input.labels).toHaveLength(1);
    expect(input.closest('label').querySelector('button')).not.toBeNull();
    const ids = input.getAttribute('aria-labelledby');
    expect(ids).toBeTruthy();
    expect(texto(ids)).toBe('Senha nova');
  });

  it('a descrição do input é a dica mais o erro', async () => {
    await montar(campoDeSenha({ error: 'Um erro' }));
    const input = document.querySelector('input[name="senha"]');
    expect(texto(input.getAttribute('aria-describedby'))).toBe('Uma dica Um erro');
  });

  it('o erro entra numa região de alerta que já estava na página', async () => {
    await montar(campoDeSenha());
    const regiao = document.querySelector('[role="alert"]');
    expect(regiao).not.toBeNull();
    expect(regiao.textContent).toBe('');
    await act(async () => { root.render(campoDeSenha({ error: 'Um erro' })); });
    expect(document.querySelector('[role="alert"]')).toBe(regiao);
    expect(regiao.contains(document.getElementById('erro'))).toBe(true);
    expect(regiao.textContent).toBe('Um erro');
  });

  it('o ícone é decorativo, mesmo que o componente do ícone não se esconda sozinho', async () => {
    const IconeCru = () => h('svg', { 'data-icone': 'sim' });
    await montar(h(AuthField, { label: 'Senha', icon: IconeCru }, h(AuthInput, { name: 'senha' })));
    const icone = document.querySelector('svg[data-icone]');
    expect(icone.getAttribute('aria-hidden')).toBeNull();
    expect(icone.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('sem erro nem dica, não desenha os parágrafos', async () => {
    await montar(h(AuthField, { label: 'Senha', icon: Lock }, h(AuthInput, { name: 'senha' })));
    expect(document.querySelectorAll('p')).toHaveLength(0);
  });
});

describe('AuthInput', () => {
  it('a classe de quem chama entra e vence a do login em conflito', async () => {
    await montar(h(AuthField, { label: 'Código', icon: Lock }, h(AuthInput, { name: 'code', className: 'font-mono text-lg' })));
    const input = document.querySelector('input[name="code"]');
    expect(input.classList.contains('font-mono')).toBe(true);
    expect(input.classList.contains('text-lg')).toBe(true);
    expect(input.classList.contains('text-[14px]')).toBe(false);
    expect(input.classList.contains('h-12')).toBe(true);
  });

  it('o ref chega ao input', async () => {
    const ref = createRef();
    await montar(h(AuthField, { label: 'Código', icon: Lock }, h(AuthInput, { ref, name: 'code' })));
    expect(ref.current).toBe(document.querySelector('input[name="code"]'));
  });

  it('quem chama pode trocar o aria-labelledby', async () => {
    await montar(h(AuthField, { label: 'Código', icon: Lock }, h(AuthInput, { name: 'code', 'aria-labelledby': 'outro-rotulo' })));
    expect(document.querySelector('input[name="code"]').getAttribute('aria-labelledby')).toBe('outro-rotulo');
  });
});

describe('AuthField: erro', () => {
  it('o erro troca a cor da borda em vez de empilhar duas', async () => {
    await montar(campoDeSenha({ error: 'Um erro' }));
    const caixa = caixaDoInput();
    expect(caixa.classList.contains('border-rose-300')).toBe(true);
    expect(caixa.classList.contains('border-gray-200')).toBe(false);
  });

  it('com erro, o campo em foco continua na cor do erro', async () => {
    await montar(campoDeSenha({ error: 'Um erro' }));
    const caixa = caixaDoInput();
    expect(caixa.classList.contains('focus-within:border-rose-400')).toBe(true);
    expect(caixa.classList.contains('focus-within:ring-rose-500/15')).toBe(true);
    expect(caixa.classList.contains('focus-within:border-brand-500')).toBe(false);
    expect(caixa.classList.contains('focus-within:ring-brand-500/15')).toBe(false);
  });

  it('sem erro, o campo em foco usa a cor da marca', async () => {
    await montar(campoDeSenha());
    const caixa = caixaDoInput();
    expect(caixa.classList.contains('focus-within:border-brand-500')).toBe(true);
    expect(caixa.classList.contains('focus-within:ring-brand-500/15')).toBe(true);
    expect(caixa.classList.contains('focus-within:border-rose-400')).toBe(false);
    expect(caixa.classList.contains('focus-within:ring-rose-500/15')).toBe(false);
  });
});

describe('AuthPasswordToggle', () => {
  it('o botão se chama Mostrar senha com a senha escondida e Ocultar senha com ela à mostra', async () => {
    await montar(h(AuthPasswordToggle, { shown: false, onToggle: () => {} }));
    let botao = document.querySelector('button');
    expect(botao.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(botao.querySelector('svg.lucide-eye')).not.toBeNull();
    await act(async () => { root.render(h(AuthPasswordToggle, { shown: true, onToggle: () => {} })); });
    botao = document.querySelector('button');
    expect(botao.getAttribute('aria-label')).toBe('Ocultar senha');
    expect(botao.querySelector('svg.lucide-eye-off')).not.toBeNull();
  });

  it('não tem title, senão o leitor de tela repete o nome como descrição', async () => {
    await montar(h(AuthPasswordToggle, { shown: false, onToggle: () => {} }));
    expect(document.querySelector('button').hasAttribute('title')).toBe(false);
  });

  it('o clique chama onToggle uma vez e não envia o formulário', async () => {
    const onToggle = vi.fn();
    const onSubmit = vi.fn((e) => e.preventDefault());
    await montar(h('form', { onSubmit }, h(AuthPasswordToggle, { shown: false, onToggle })));
    await act(async () => { document.querySelector('button').click(); });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
