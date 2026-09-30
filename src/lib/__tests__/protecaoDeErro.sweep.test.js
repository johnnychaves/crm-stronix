// Tudo o que o App monta fora do AppErrorBoundary do conteúdo precisa de uma
// proteção de erro própria: os modais do fim do App, as peças do cabeçalho e as
// telas de entrada, que são desenhadas sem sessão. Sem ela, um erro ali
// desmonta a raiz do React e a página fica branca, como em 2026-09-25 (Sentry
// STRONILEAD-6 e STRONILEAD-8). A varredura lê o App.jsx, então um modal novo
// montado no fim do App, ou uma tela nova de entrada, já entra na cobrança.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = readFileSync(fileURLToPath(new URL('../../App.jsx', import.meta.url)), 'utf8');
const PROTECOES = ['ModalErrorBoundary', 'SilentErrorBoundary'];

// Quantas proteções estão abertas no ponto `idx` do App.jsx.
function protecoesAbertas(idx) {
  const antes = app.slice(0, idx);
  let abertas = 0;
  for (const nome of PROTECOES) {
    abertas += (antes.match(new RegExp(`<${nome}[\\s>]`, 'g')) || []).length;
    abertas -= (antes.match(new RegExp(`</${nome}>`, 'g')) || []).length;
  }
  return abertas;
}

describe('proteção de erro fora do conteúdo da tela', () => {
  it('todo componente montado depois do AppErrorBoundary está dentro de uma proteção', () => {
    const inicio = app.lastIndexOf('</AppErrorBoundary>');
    const fim = app.indexOf('</GeneralConfigContext.Provider>', inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    const montados = [...app.slice(inicio, fim).matchAll(/<([A-Z][\w.]*)[\s>/]/g)]
      .filter((m) => !PROTECOES.includes(m[1]));
    // A afirmação positiva vem antes: sem ela, um trecho vazio passaria.
    expect(montados.map((m) => m[1])).toEqual(expect.arrayContaining([
      'AddLeadModal', 'SuperConsole', 'SupportCenterModal', 'WhatsNewModal', 'WalkthroughModal', 'HelpCenterModal',
    ]));
    const soltos = montados.filter((m) => protecoesAbertas(inicio + m.index) === 0).map((m) => m[1]);
    expect(soltos).toEqual([]);
  });

  it('título, busca, sino e menu da conta do cabeçalho estão dentro de uma proteção', () => {
    const inicio = app.indexOf('<header');
    const fim = app.indexOf('</header>', inicio);
    const cabecalho = app.slice(inicio, fim);
    for (const peca of ['<h2', '<GlobalSearch', '<NotificationBell', '<PersonaMenu']) {
      const idx = cabecalho.indexOf(peca);
      expect(idx, peca).toBeGreaterThan(-1);
      expect(protecoesAbertas(inicio + idx), peca).toBeGreaterThan(0);
    }
  });
});

// Telas de entrada: as que o App desenha antes de existir sessão (login, "Esqueci
// a senha", indicação pública e convite). Saem do App.jsx antes de qualquer
// proteção, e o main.jsx não tem uma na raiz, então cada uma fica dentro de uma
// ScreenErrorBoundary. A varredura lê só o trecho que roda sem sessão: o App,
// que escolhe entre indicação, convite e app, e o AppInner, do primeiro retorno
// (carregando a sessão) até o primeiro trecho que já supõe sessão (o bloqueio da
// academia). Tela nova que entrar nesse trecho já nasce cobrada. As telas de
// bloqueio de quem tem sessão ficam de fora, de propósito.
const TELA = 'ScreenErrorBoundary';
// O que aparece nesses trechos sem ser tela: o provedor de toast, que envolve
// tudo, e o app logado, que tem as proteções dele.
const NAO_E_TELA = ['ToastProvider', 'AppInner', TELA];

// Tira comentário de bloco e de linha, no molde das outras varreduras: uma
// linha comentada tem o mesmo texto da ligada e não liga nada.
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Quantas ScreenErrorBoundary estão abertas no ponto `idx` do código.
function telasAbertas(codigo, idx) {
  const antes = codigo.slice(0, idx);
  return (antes.match(new RegExp(`<${TELA}[\\s>]`, 'g')) || []).length
    - (antes.match(new RegExp(`</${TELA}>`, 'g')) || []).length;
}

// O que o trecho sem sessão do App.jsx desenha sem proteção. `soltos` são os
// componentes fora de uma ScreenErrorBoundary. `retornosSoltos` são os retornos
// do AppInner que não abrem com ela, o que também pega uma tela feita só de
// tags do HTML.
function achadosSemSessao(fonte) {
  const codigo = semComentarios(fonte);
  const app = codigo.indexOf('export default function App()');
  const inner = codigo.indexOf('function AppInner()');
  const portoes = codigo.indexOf('if (isAuthChecking', inner);
  const sessao = codigo.indexOf('if (!appUser.superAdminOnly', portoes);
  const tags = [[app, inner], [portoes, sessao]].flatMap(([de, ate]) => (
    [...codigo.slice(de, ate).matchAll(/<([A-Z][\w.]*)[\s>/]/g)].map((m) => ({ nome: m[1], idx: de + m.index }))
  ));
  const trechoDosPortoes = codigo.slice(portoes, sessao);
  const retornos = [...trechoDosPortoes.matchAll(/\breturn\b\s*\(?\s*(<[A-Za-z][\w.]*)?/g)].map((m) => m[1]);
  return {
    ancoras: [app, inner, portoes, sessao],
    tags: tags.map((t) => t.nome),
    soltos: tags
      .filter((t) => !NAO_E_TELA.includes(t.nome) && telasAbertas(codigo, t.idx) <= 0)
      .map((t) => t.nome),
    trechoDosPortoes,
    retornos,
    retornosSoltos: retornos.filter((abre) => abre !== `<${TELA}`),
  };
}

// A cópia sem a n-ésima ScreenErrorBoundary: sai a tag que abre e a que fecha, e
// os filhos ficam onde estavam.
function tirarProtecao(codigo, n) {
  const todas = [...codigo.matchAll(new RegExp(`<${TELA}(?=[\\s>])[^>]*>|</${TELA}>`, 'g'))];
  const alvo = todas.filter((m) => !m[0].startsWith('</'))[n];
  let fundo = 0;
  for (const m of todas.slice(todas.indexOf(alvo))) {
    fundo += m[0].startsWith('</') ? -1 : 1;
    if (fundo === 0) {
      return codigo.slice(0, alvo.index)
        + codigo.slice(alvo.index + alvo[0].length, m.index)
        + codigo.slice(m.index + m[0].length);
    }
  }
  throw new Error(`${TELA} sem tag de fechamento`);
}

describe('proteção de erro das telas de entrada', () => {
  const achados = achadosSemSessao(app);

  it('a varredura enxerga o trecho sem sessão do App.jsx', () => {
    // A afirmação positiva vem antes: sem ela, um trecho vazio passaria.
    expect(achados.ancoras.every((i) => i > -1)).toBe(true);
    expect(achados.ancoras).toEqual([...achados.ancoras].sort((a, b) => a - b));
    expect(achados.tags).toEqual(expect.arrayContaining([
      'ReferralLandingScreen', 'AcceptInviteScreen', 'AppInner', 'ForgotPasswordScreen', 'LoginScreen',
    ]));
    expect(achados.retornos.length).toBeGreaterThanOrEqual(3);
  });

  it('toda tela desenhada sem sessão está dentro de uma ScreenErrorBoundary', () => {
    expect(achados.soltos, 'componentes sem ScreenErrorBoundary no trecho sem sessão do App.jsx').toEqual([]);
  });

  it('todo retorno antecipado sem sessão abre com a ScreenErrorBoundary', () => {
    expect(achados.retornosSoltos, 'retornos do AppInner que não abrem com a ScreenErrorBoundary').toEqual([]);
  });

  it('as telas que se revezam no AppInner têm key própria, para o aviso de uma não ficar preso', () => {
    const aberturas = achados.trechoDosPortoes.match(new RegExp(`<${TELA}(?=[\\s>])[^>]*>`, 'g')) || [];
    expect(aberturas.length).toBeGreaterThanOrEqual(3);
    for (const abertura of aberturas) expect(abertura).toMatch(/\bkey=/);
    // Duas telas com a mesma key seriam a mesma proteção, e o aviso ficaria preso.
    expect(new Set(aberturas).size).toBe(aberturas.length);
  });
});

// A varredura acima só vale se enxerga o que sai da proteção. Aqui ela roda em
// cópias do App.jsx, na memória, com uma proteção a menos ou com uma tela nova
// sem nenhuma.
describe('a varredura das telas de entrada reprova o que ficar sem proteção', () => {
  const codigo = semComentarios(app);
  const quantas = [...codigo.matchAll(new RegExp(`<${TELA}(?=[\\s>])`, 'g'))].length;

  it('tirar a proteção de qualquer uma das telas derruba a varredura', () => {
    expect(quantas).toBeGreaterThanOrEqual(5);
    const apontadas = new Set();
    for (let n = 0; n < quantas; n += 1) {
      const achados = achadosSemSessao(tirarProtecao(codigo, n));
      expect(achados.soltos.length + achados.retornosSoltos.length, `sem a proteção ${n}`).toBeGreaterThan(0);
      achados.soltos.forEach((nome) => apontadas.add(nome));
    }
    expect([...apontadas]).toEqual(expect.arrayContaining([
      'ReferralLandingScreen', 'AcceptInviteScreen', 'ForgotPasswordScreen', 'LoginScreen',
    ]));
  });

  it('uma tela nova sem proteção, montada antes do login, derruba a varredura', () => {
    // Uma tela de componente e uma feita só de tags do HTML.
    for (const nova of ['<TelaDeManutencao />', '<div>Em manutenção</div>']) {
      const copia = codigo.replace('if (!appUser) {', `if (manutencao) return ${nova};\n  if (!appUser) {`);
      expect(copia, nova).not.toBe(codigo);
      const achados = achadosSemSessao(copia);
      expect(achados.soltos.length + achados.retornosSoltos.length, nova).toBeGreaterThan(0);
    }
  });
});
