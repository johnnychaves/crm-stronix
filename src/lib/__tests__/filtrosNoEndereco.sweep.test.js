// Filtro de tela mora no endereço, e só lá. Esta varredura cobra isso de toda
// tela, inclusive das que forem criadas depois: ninguém que desenha tela lê a
// query direto, nenhuma view guarda em estado o que agora é parâmetro, e nem
// view nem App.jsx põem parâmetro ou sub-tela numa key de componente (key com
// filtro faz a tela remontar e reler a coleção inteira a cada clique, o que
// não quebra nada e não aparece no console).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREEN_PARAM_NAMES } from '../screenParams.js';
import { SCREENS } from '../routes.js';

const SRC = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const views = sourceFiles(join(SRC, 'views')).map((f) => [relative(SRC, f), readFileSync(f, 'utf8')]);
// As cinco pastas que desenham tela, no mesmo molde do leadLinkSweep: um
// `useSearchParams` num componente ou num hook cria uma segunda fonte da
// verdade tão ruim quanto um dentro da view. O App.jsx fica de fora porque é
// ele quem lê `location.search`, para o convite e para o `funnelFromSearch`.
const telas = ['views', 'components', 'modals', 'hooks', 'contexts']
  .flatMap((pasta) => sourceFiles(join(SRC, pasta)))
  .map((f) => [relative(SRC, f), readFileSync(f, 'utf8')]);
// `src/` inteiro, para a regra do navigate: o state da ficha nasce fora das
// views (App.jsx e o LeadLink).
const fontes = sourceFiles(SRC).map((f) => [relative(SRC, f), readFileSync(f, 'utf8')]);
const hook = readFileSync(join(SRC, 'hooks', 'useScreenParams.js'), 'utf8');
const app = readFileSync(join(SRC, 'App.jsx'), 'utf8');

// Tira comentário de bloco e de linha. Serve às conferências que perguntam se
// um nome é USADO num arquivo: o comentário do hook explica justamente por que
// ele não usa hrefFor, e sem esta limpeza a explicação derrubaria o teste.
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('varredura dos filtros no endereço', () => {
  it('nenhuma tela lê a query direto: quem lê é o screenParams, pelo hook', () => {
    // Pelo código, sem os comentários: um comentário futuro que cite
    // `location.search` para explicar a regra não pode deixar o CI vermelho.
    for (const [nome, texto] of telas) {
      const codigo = semComentarios(texto);
      expect(codigo.includes('location.search'), nome).toBe(false);
      expect(codigo.includes('useSearchParams'), nome).toBe(false);
    }
  });

  it('nenhuma tela guarda em estado o que virou parâmetro do endereço', () => {
    // Os nomes que sumiram das telas na entrega 2. Voltar com qualquer um
    // deles é voltar a ter filtro que não sobrevive a um F5.
    const proibidos = [
      'setMonthKey', 'setCompareOn', 'setCompareKey', 'setPerson', 'setFunnel',
      'setRespFilter', 'setOnlyOverdue', 'setStatusFilters', 'setConsultantFilters',
      'setOverdueOnly', 'setHotOnly', 'setDayTab', 'setProfFilter', 'setActiveProfileTab',
      'setSection',
    ];
    // A categoria da Meta diária também virou parâmetro, e mesmo assim o
    // `setFilter` dela NÃO é cobrado por esta lista, de propósito: o nome é
    // genérico demais. Hoje o `DailyGoalView` chama assim o atalho que escreve
    // no endereço e o `SuperConsole` tem um estado próprio com o mesmo nome,
    // que não é filtro de tela. Quem desconfiar da categoria confere à mão que
    // o `setFilter` do `DailyGoalView` continua escrevendo no endereço.
    // Palavra inteira: `setFunnelDialog` e `setFunnelName` da seção de Funis
    // contêm `setFunnel` como pedaço e não são filtro de tela nenhum.
    for (const [nome, texto] of views) {
      for (const p of proibidos) {
        expect(new RegExp(`\\b${p}\\b`).test(texto), `${nome} tem ${p}`).toBe(false);
      }
    }
  });

  it('nenhum parâmetro entra numa key de componente', () => {
    // Lista curada e conferida: os nomes curtos do endereço (`de`, `dia`,
    // `mes`, `cat`) aparecem como pedaço de outras palavras e dariam alarme
    // falso (`m.de` do Console, `d.day` da régua de dias da visão Equipe, que
    // ficou fora desta entrega).
    // `funnel`, `person` e `sub` são os nomes de VARIÁVEL que as telas usam ao
    // desestruturar o hook, e são os erros mais caros: `key={funnel}` no
    // Kanban ou `key={person}` num dashboard remonta a tela e relê a coleção a
    // cada troca de filtro. `funil` e `pessoa` são nomes de query e nunca
    // aparecem como variável, então ficam na lista só por garantia.
    const alvos = [
      'monthKey', 'compareKey', 'compareOn', 'respFilter', 'statusFilters', 'consultantFilters',
      'profFilter', 'overdueOnly', 'onlyOverdue', 'hotOnly', 'dayTab', 'selectedFunnelId',
      'funnelId', 'funil', 'resp', 'atraso', 'quente', 'fase', 'pessoa', 'comparar',
      'funnel', 'person', 'sub',
    ];
    // O App.jsx entra junto: é ele que monta a chave da tela, e é ali que a
    // sub-tela entraria sem ninguém ver.
    for (const [nome, texto] of [...views, ['App.jsx', app]]) {
      for (const linha of texto.split('\n')) {
        if (!linha.includes('key={')) continue;
        for (const p of alvos) {
          expect(new RegExp(`\\b${p}\\b`).test(linha), `${nome}: ${linha.trim()}`).toBe(false);
        }
      }
    }
  });

  it('a troca de filtro é sempre replace e leva o state junto', () => {
    expect(hook.includes('navigate(')).toBe(true);
    expect(/\{\s*replace:\s*true,\s*state\s*\}/.test(hook)).toBe(true);
    // O destino sai do caminho de agora, nunca de hrefFor: o Operacional tem
    // dois endereços válidos e trocar entre eles empilharia entrada nova com a
    // mesma chave de tela.
    expect(semComentarios(hook).includes('hrefFor')).toBe(false);
  });

  // O `openProfile` do App.jsx é a única chamada com replace condicional e
  // state próprio. Ela é segura porque no ramo do replace (a mesma ficha já
  // aberta) o `profileFrom` é nulo, então a varredura a pula e o teste
  // seguinte congela o texto dela.
  const OPEN_PROFILE = "navigate(href, { replace: href === location.pathname, state: profileFrom ? { from: profileFrom } : null })";

  it('nenhum navigate de src/ grava state próprio numa entrada que pode ser a primeira', () => {
    // A premissa do backTarget (ver o comentário dele em routes.js) é que só o
    // push grava state, e push sempre soma 1 no idx. O react-router NÃO garante
    // isso: medido na 7.18.4, um replace com state na primeira entrada grava o
    // state com idx 0. Quem garante é o app, e este teste é a cobrança. Por
    // isso o replace só passa quando é `replace: false` escrito, e o state só
    // passa quando é o `location.state` repassado, o `state` do hook ou nulo:
    // `replace: <condição>` com objeto literal é a forma que derruba a
    // premissa e ela não pode entrar sem ser vista.
    for (const [nome, texto] of fontes) {
      for (const trecho of texto.split('navigate(').slice(1)) {
        const chamada = trecho.slice(0, 200);
        if (`navigate(${chamada}`.startsWith(OPEN_PROFILE)) continue;
        // Pelo valor escrito, e não por lookahead: `/replace:\s*(?!false\b)/`
        // parece servir e passa em tudo, porque o `\s*` volta atrás e o
        // lookahead cai no espaço depois dos dois-pontos. Medido em 23/09/2026.
        const replaceDito = chamada.match(/replace:\s*([\w.$]+)/)?.[1] ?? null;
        const stateDito = chamada.match(/state:\s*([\w.$]+|\{)/)?.[1] ?? null;
        const temReplace = replaceDito !== null && replaceDito !== 'false';
        const temStateProprio = stateDito !== null && !['location.state', 'state', 'null'].includes(stateDito);
        expect(temReplace && temStateProprio, `${nome}: navigate(${chamada.split('\n')[0]}`).toBe(false);
      }
    }
  });

  it('o openProfile continua gravando origem só quando a ficha veio de outra tela', () => {
    // Mexer nestas duas linhas deixa a varredura vermelha, que é o ponto: o
    // dia em que o `profileFrom` puder ser não nulo no ramo do replace, o
    // backTarget precisa do ramo do `from` de volta.
    expect(app.includes("const profileFrom = activeTab === 'ficha' ? null : activeTab;")).toBe(true);
    expect(app.includes(OPEN_PROFILE)).toBe(true);
  });

  it('a chave da tela continua saindo só da tela mostrada', () => {
    // Congeladas as duas montagens, e não só a função pura: somar a sub-tela
    // aqui remonta a tela inteira a cada troca de seção das Configurações ou
    // de aba da ficha, e perde a rolagem junto.
    expect(app.includes('<AppErrorBoundary key={screenKey(shown)}>')).toBe(true);
    expect(app.includes('useRouteScroll(contentScrollRef, screenKey(shown))')).toBe(true);
    for (const trecho of app.split('\n').filter((l) => l.includes('screenKey('))) {
      expect(trecho.includes('search'), trecho.trim()).toBe(false);
    }
  });

  it('toda tela com parâmetro existe na tabela de telas, e o apelido do endereço curto bate', () => {
    for (const tela of Object.keys(SCREEN_PARAM_NAMES)) {
      expect(Object.prototype.hasOwnProperty.call(SCREENS, tela), tela).toBe(true);
    }
    // A afirmação positiva vem antes: sem ela, os dois apelidos sumindo da
    // tabela deixariam `undefined` igual a `undefined` e o teste passaria.
    expect(SCREEN_PARAM_NAMES.dashboard).toContain('mes');
    expect(SCREEN_PARAM_NAMES.dashboard).toEqual(SCREEN_PARAM_NAMES.dashOperacional);
  });
});
