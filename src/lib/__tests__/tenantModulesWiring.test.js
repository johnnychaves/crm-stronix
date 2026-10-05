// O app lê os módulos da academia no login, junto com o documento
// tenants/{id} que ele já lê para o bloqueio, e os guarda no appUser
// (tenantModules). É o appUser que toda tela recebe, e é ele que o "Acessar
// como" troca inteiro quando entra ou sai de outra academia sem recarregar a
// página: o signInWithCustomToken dispara o onAuthStateChanged, que relê o
// documento da academia nova. Guardar os módulos num estado à parte deixaria
// uma janela com o appUser de uma academia e os módulos de outra. Este teste
// cobra que todo appUser montado no login leva o campo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');

// O objeto literal de cada setAppUser({ ... }), pelas chaves balanceadas.
function objetosDoSetAppUser(fonte) {
  const achados = [];
  let i = fonte.indexOf('setAppUser({');
  while (i !== -1) {
    const inicio = i + 'setAppUser('.length;
    let fundo = 0;
    let j = inicio;
    for (; j < fonte.length; j++) {
      if (fonte[j] === '{') fundo++;
      else if (fonte[j] === '}' && --fundo === 0) break;
    }
    achados.push(fonte.slice(inicio, j + 1));
    i = fonte.indexOf('setAppUser({', j);
  }
  return achados;
}

describe('módulos da academia no appUser', () => {
  const objetos = objetosDoSetAppUser(app);

  it('acha os appUser montados no login', () => {
    // Membro achado pelo uid, membro achado pelo e-mail e as duas sessões só
    // de super-admin.
    expect(objetos.length).toBeGreaterThanOrEqual(4);
  });

  it('todo appUser montado no login leva tenantModules', () => {
    for (const o of objetos) expect(o, o.slice(0, 80)).toMatch(/\btenantModules\b/);
  });

  it('o módulo vem da academia, nunca do cadastro da pessoa: o campo fica depois do ...userDoc.data()', () => {
    const comCadastro = objetos.filter((o) => o.includes('...userDoc.data()'));
    expect(comCadastro).toHaveLength(2);
    for (const o of comCadastro) expect(o.indexOf('tenantModules')).toBeGreaterThan(o.indexOf('...userDoc.data()'));
  });

  it('a lista sai do documento da academia, pela normalizeModules', () => {
    expect(app).toMatch(/import \{[^}]*\bnormalizeModules\b[^}]*\} from '\.\/lib\/modules\.js';/);
    expect(app).toMatch(/tenantModules\s*=\s*normalizeModules\(\s*tData\?\.modules\s*\)/);
  });

  it('a falta fecha: a lista nasce vazia antes da leitura, e a leitura que falha não a preenche', () => {
    // O trecho do login, do onAuthStateChanged até o unsubscribe.
    const inicio = app.indexOf('onAuthStateChanged(auth');
    const login = app.slice(inicio, app.indexOf('return () => unsubscribe();', inicio));
    const declaracao = login.indexOf('let tenantModules = [];');
    const leitura = login.indexOf("getDoc(doc(db, 'tenants', tenantId))");
    expect(declaracao).toBeGreaterThan(-1);
    expect(leitura).toBeGreaterThan(declaracao);
    expect(login.indexOf('setAppUser({')).toBeGreaterThan(declaracao);
    // A declaração e uma atribuição só, a da leitura que deu certo. O catch da
    // leitura não mexe na lista.
    expect(login.match(/\btenantModules\s*=(?!=)/g)).toHaveLength(2);
  });
});
