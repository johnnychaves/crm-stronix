// @vitest-environment jsdom
// A moldura e o campo das telas de entrada (login e "Esqueci a senha").
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { Mail } from 'lucide-react';
import { AuthLayout, AuthTenantChip } from '../../views/auth/AuthLayout.jsx';
import { AuthField, AuthInput } from '../../views/auth/AuthField.jsx';

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
});

describe('AuthField', () => {
  it('mostra a dica e o erro com os ids que a tela liga no input', async () => {
    await montar(h(AuthField, { label: 'E-mail', icon: Mail, hint: 'Uma dica', hintId: 'dica', error: 'Um erro', errorId: 'erro' },
      h(AuthInput, { name: 'email', 'aria-describedby': 'dica erro' })));
    expect(document.getElementById('dica').textContent).toBe('Uma dica');
    expect(document.getElementById('erro').textContent).toBe('Um erro');
    expect(document.querySelector('label').textContent).toContain('E-mail');
    expect(document.querySelector('input[name="email"]').getAttribute('aria-describedby')).toBe('dica erro');
  });

  it('sem erro nem dica, não desenha os parágrafos', async () => {
    await montar(h(AuthField, { label: 'Senha', icon: Mail }, h(AuthInput, { name: 'senha' })));
    expect(document.querySelectorAll('p')).toHaveLength(0);
  });
});
