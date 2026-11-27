// A configuração dos faltosos chega às telas pelo App (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações" e "A aba Faltosos"). O App.jsx não monta em teste, então
// esta varredura lê o código dele, no molde do professorShell.test.js: a
// assinatura de stronix_config/faltosos só com o módulo, a academia junto do
// que foi lido e o `faltosos` no contexto. O padrão do contexto, fora do
// Provider, é renderizado de verdade.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';

const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const app = semComentarios(readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8'));

describe('configuração dos faltosos no App', () => {
  it('importa o caminho, o módulo e a leitura da configuração', () => {
    const doFirebase = app.slice(app.indexOf('import {\n  auth,'), app.indexOf("} from './lib/firebase.js';"));
    expect(doFirebase).toContain('CONFIG_FALTOSOS_ID');
    expect(app).toContain("import { normalizeModules, hasModule, MODULES } from './lib/modules.js';");
    expect(app).toContain("import { CONFIG_FALTOSOS_PADRAO, normalizarConfigFaltosos } from './lib/faltosos/configFaltosos.js';");
  });

  it('assina stronix_config/faltosos só com o módulo, dentro da leitura de dados, e desliga junto com o resto', () => {
    const efeito = app.indexOf('if (professorAccessOff(appUser)) { setLoadingData(false); return; }');
    const guarda = app.indexOf('if (hasModule(appUser.tenantModules, MODULES.FALTOSOS)) {', efeito);
    const fim = app.indexOf('}, [firebaseUser, appUser, tenantBlock, listenersActive]);', efeito);
    expect(efeito).toBeGreaterThan(-1);
    expect(guarda).toBeGreaterThan(efeito);
    expect(fim).toBeGreaterThan(guarda);
    const bloco = app.slice(guarda, app.indexOf('let unsubUsers', guarda));
    expect(bloco).toContain("doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID)");
    expect(bloco).toContain('setFaltososLido({ tenant: configTenant, config: normalizarConfigFaltosos(snap.exists() ? snap.data() : null), erro: false })');
    expect(bloco).toContain('setFaltososLido({ tenant: configTenant, config: CONFIG_FALTOSOS_PADRAO, erro: true })');
    expect(app.slice(guarda, fim)).toContain('unsubFaltosos();');
  });

  it('a configuração só vale para a academia de onde veio, e vai no contexto', () => {
    expect(app).toContain('faltososLido.tenant !== null && faltososLido.tenant === faltososTenant');
    expect(app).toMatch(/const generalConfigValue = useMemo\(\s*\(\) => \(\{[^}]*\bfaltosos \}\),\s*\[[^\]]*\bfaltosos\]/);
  });
});

describe('GeneralConfigContext fora do Provider', () => {
  it('faltosos é null, e as telas caem no padrão pelo configDasTelas', () => {
    function Sonda() {
      const { faltosos } = useGeneralConfig();
      return createElement('output', null, faltosos === null ? 'faltosos:null' : 'faltosos:outro');
    }
    expect(renderToString(createElement(Sonda))).toContain('faltosos:null');
  });
});
