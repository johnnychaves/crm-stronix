// Anel de foco. O anel padrão do app era `focus-visible:ring-2
// focus-visible:ring-brand-500/40`: azul a 40% de opacidade, que no balão
// branco dá 1,6:1 e no escuro 1,8:1. Um indicador de foco precisa de 3:1
// contra o fundo, e esse anel era mais fraco que o do próprio navegador, que
// ele substituía (o `outline-none` tira o anel do navegador).
//
// O anel agora tem nome, `anel-foco` (o @utility do index.css): 2 px sólidos
// na cor do --ring, brand-600 no claro e brand-500 no escuro. Tela nova usa
// `focus-visible:anel-foco` em vez de copiar classes. Este teste:
// - confere o @utility no index.css;
// - refaz a conta de contraste com as cores de verdade do index.css e do
//   tema do Tailwind, nos fundos onde o anel aparece;
// - cobra a folga (ring-offset) quando o elemento tem fundo brand sólido,
//   porque ali o anel teria a mesma cor do botão;
// - barra o anel antigo (e qualquer anel brand com transparência no
//   focus-visible) em src/.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url));
const css = readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const temaTailwind = readFileSync(createRequire(import.meta.url).resolve('tailwindcss/theme.css'), 'utf8');
const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');
const barra = readFileSync(join(SRC, 'views', 'dashboard', 'OperacionalToolbar.jsx'), 'utf8');

// --- leitura das variáveis -------------------------------------------------

// Corpo do primeiro bloco cujo seletor é exatamente `seletor`.
function corpo(texto, seletor) {
  const re = new RegExp(`(^|\\n)\\s*${seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = re.exec(texto);
  if (!m) throw new Error(`bloco ${seletor} não encontrado`);
  return m[2];
}
function variavel(bloco, nome) {
  const m = new RegExp(`${nome}\\s*:\\s*([^;]+);`).exec(bloco);
  if (!m) throw new Error(`${nome} não encontrada`);
  return m[1].trim();
}
const claro = corpo(css, ':root');
const escuro = corpo(css, '.dark');
const tema = corpo(css, '@theme');
const tw = (nome) => variavel(temaTailwind, `--color-${nome}`);

// --- cor e contraste (WCAG 2.x) --------------------------------------------

function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const enc = (c) => {
    c = Math.min(1, Math.max(0, c));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  };
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
function cor(texto) {
  const s = texto.trim().toLowerCase();
  let m;
  if ((m = /^#([0-9a-f]{6})$/.exec(s))) {
    return { rgb: [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  }
  if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { rgb: p.slice(0, 3), a: p[3] ?? 1 };
  }
  if ((m = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(s))) {
    return { rgb: oklch(Number(m[1]) / 100, Number(m[2]), Number(m[3])), a: 1 };
  }
  throw new Error(`cor não reconhecida: ${texto}`);
}
// Cor com transparência pintada sobre um fundo opaco.
function sobre(frente, fundo) {
  return { rgb: frente.rgb.map((v, i) => v * frente.a + fundo.rgb[i] * (1 - frente.a)), a: 1 };
}
function luminancia({ rgb }) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(anel, fundo) {
  const pintado = sobre(anel, fundo);
  const [a, b] = [luminancia(pintado), luminancia(fundo)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// --- fundos onde o anel aparece ---------------------------------------------

// A raiz do App pinta a página escura de neutral-950 (conferido no teste).
const paginaEscura = cor(tw('neutral-950'));
// A barra fixa dos painéis (Operacional, CRM, Gerencial) tem fundo próprio no
// escuro, escrito na classe; a conta lê o valor do arquivo.
const corDaBarra = /dark:bg-\[(#[0-9a-fA-F]{6})\]/.exec(barra)?.[1] ?? '#000000';

const FUNDOS = {
  claro: {
    'cartão (--card)': cor(variavel(claro, '--card')),
    'balão (--popover)': cor(variavel(claro, '--popover')),
    'página e diálogo (--background)': cor(variavel(claro, '--background')),
    'chip ativo (brand-50)': cor(variavel(tema, '--color-brand-50')),
    'linha em foco (slate-50)': cor(tw('slate-50')),
  },
  escuro: {
    'página (neutral-950)': paginaEscura,
    'cartão (--card sobre a página)': sobre(cor(variavel(escuro, '--card')), paginaEscura),
    'balão (--popover)': cor(variavel(escuro, '--popover')),
    'diálogo (--background)': cor(variavel(escuro, '--background')),
    'barra dos painéis': cor(corDaBarra),
    'cabeçalho e menu (ink-900)': cor(variavel(tema, '--color-ink-900')),
    'linha antiga (neutral-900)': cor(tw('neutral-900')),
  },
};

// Tira comentário de bloco (inclusive o {/* */} do JSX) e de linha inteira.
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// A expressão de classes que contém a posição `idx`: className="...",
// className={...} ou cn(...). Sem uma delas em volta, null.
function expressaoDeClasses(texto, idx) {
  const base = Math.max(0, idx - 2000);
  const antes = texto.slice(base, idx);
  let melhor = -1;
  let marca = null;
  for (const m of ['className="', "className='", 'className={', 'cn(']) {
    const p = antes.lastIndexOf(m);
    if (p > melhor) [melhor, marca] = [p, m];
  }
  if (melhor < 0) return null;
  const inicio = base + melhor;
  if (marca === 'className="' || marca === "className='") {
    const fim = texto.indexOf(marca.at(-1), inicio + marca.length);
    return fim > idx ? texto.slice(inicio, fim + 1) : null;
  }
  let fundo = 0;
  for (let i = inicio + marca.length - 1; i < texto.length; i++) {
    const c = texto[i];
    if (c === '(' || c === '{') fundo++;
    else if (c === ')' || c === '}') {
      fundo--;
      if (fundo === 0) return i > idx ? texto.slice(inicio, i + 1) : null;
    }
  }
  return null;
}

// Fundo brand sólido (bg-brand-600/700/800 ou bg-primary), com ou sem
// variante de estado, menos o que só aparece no hover. Tom com transparência
// (bg-brand-600/20) não conta.
function temFundoBrand(trecho) {
  for (const m of trecho.matchAll(/(\S*?)bg-(?:brand-(?:600|700|800)|primary)(?![\w/-])/g)) {
    if (!/hover:$/.test(m[1])) return true;
  }
  return false;
}
const faltaFolga = (trecho) => Boolean(trecho) && temFundoBrand(trecho) && !/\bring-offset-[1-9]/.test(trecho);

function fontes(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) {
      if (nome !== '__tests__') out.push(...fontes(full));
    } else if (/\.jsx?$/.test(nome)) {
      out.push(full);
    }
  }
  return out;
}

describe('anel de foco do app', () => {
  it('o index.css define o anel-foco: 2 px sólidos na cor do --ring', () => {
    const m = /@utility\s+anel-foco\s*\{([^}]*)\}/.exec(css);
    expect(m).not.toBeNull();
    const classes = m[1].replace(/@apply|;/g, ' ').split(/\s+/).filter(Boolean);
    expect(classes.sort()).toEqual(['ring-2', 'ring-ring']);
  });

  it('os fundos da conta são os que as telas pintam', () => {
    expect(app).toMatch(/\bdark:bg-neutral-950\b/);
    expect(barra).toMatch(/dark:bg-\[#[0-9a-fA-F]{6}\]/);
  });

  it('dá 3:1 ou mais em todos os fundos, no claro e no escuro', () => {
    const anel = { claro: cor(variavel(claro, '--ring')), escuro: cor(variavel(escuro, '--ring')) };
    expect(anel.claro.a).toBe(1);
    expect(anel.escuro.a).toBe(1);
    const fracos = [];
    for (const tom of ['claro', 'escuro']) {
      for (const [nome, fundo] of Object.entries(FUNDOS[tom])) {
        const c = contraste(anel[tom], fundo);
        if (c < 3) fracos.push(`${tom} · ${nome}: ${c.toFixed(2)}:1`);
      }
    }
    expect(fracos).toEqual([]);
  });

  it('o anel antigo ficava abaixo de 3:1 (a conta enxerga o problema)', () => {
    const antigo = { ...cor(variavel(tema, '--color-brand-500')), a: 0.4 };
    expect(contraste(antigo, FUNDOS.claro['balão (--popover)'])).toBeLessThan(2);
    expect(contraste(antigo, FUNDOS.escuro['balão (--popover)'])).toBeLessThan(2);
  });

  it('em fundo brand sólido o anel ganha a folga da cor da página (ring-offset)', () => {
    // O anel tem a cor do botão principal: num fundo bg-brand-600 ele some no
    // próprio botão, que só parece 2 px maior. A folga separa os dois. A
    // conferência olha a expressão de classes do elemento (className="...",
    // className={...} ou cn(...)); fundo que vem de constante (o BTN_KINDS do
    // SettingsBtn) fica de fora dela e é conferido no teste seguinte.
    const achados = [];
    for (const arquivo of fontes(SRC)) {
      const texto = semComentarios(readFileSync(arquivo, 'utf8'));
      for (const m of texto.matchAll(/anel-foco/g)) {
        const trecho = expressaoDeClasses(texto, m.index);
        if (faltaFolga(trecho)) achados.push(`${relative(SRC, arquivo)}: ${trecho.replace(/\s+/g, ' ').slice(0, 120)}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('o SettingsBtn, que tem o tipo principal em brand sólido, leva a folga', () => {
    const bits = readFileSync(join(SRC, 'views', 'settings', 'settingsBits.jsx'), 'utf8');
    expect(bits).toMatch(/primary:\s*'bg-brand-600/);
    expect(bits).toContain("'focus-visible:outline-none focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background',");
  });

  it('a conferência da folga enxerga o fundo brand na mesma expressão de classes', () => {
    const achar = (codigo) => faltaFolga(expressaoDeClasses(codigo, codigo.indexOf('anel-foco')));
    expect(achar(`<button className="bg-brand-600 text-white focus-visible:anel-foco" />`)).toBe(true);
    expect(achar(`cn('h-9 focus-visible:anel-foco', on ? 'bg-brand-600 text-white' : 'bg-card')`)).toBe(true);
    expect(achar(`className={cn('h-9 focus-visible:anel-foco', on && 'bg-primary')}`)).toBe(true);
    expect(achar(`cn('h-9 focus-visible:anel-foco focus-visible:ring-offset-2', on && 'bg-brand-600')`)).toBe(false);
    expect(achar(`cn('h-9 focus-visible:anel-foco', on && 'bg-brand-50 dark:bg-brand-500/15')`)).toBe(false);
    expect(achar(`cn('h-9 focus-visible:anel-foco', on && 'bg-brand-600/20')`)).toBe(false);
    expect(achar(`cn('h-9 focus-visible:anel-foco hover:bg-brand-600')`)).toBe(false);
    expect(achar(`const FOCO = 'focus-visible:anel-foco';`)).toBe(false);
  });

  it('nenhum arquivo de src/ usa anel brand com transparência no focus-visible', () => {
    const achados = [];
    for (const arquivo of fontes(SRC)) {
      const texto = readFileSync(arquivo, 'utf8');
      for (const m of texto.matchAll(/focus-visible:(?:[a-z-]+:)*ring-brand-\d{2,3}\/\d+/g)) {
        achados.push(`${relative(SRC, arquivo)}: ${m[0]}`);
      }
    }
    expect(achados).toEqual([]);
  });
});
