// Filtro de cada tela no endereço: leitura, montagem, ida e volta, e o
// saneamento contra o que só a tela sabe. Tudo puro, tudo em node.
import { describe, it, expect } from 'vitest';
import {
  readScreenParams, screenParamsQuery, funnelFromSearch, SCREEN_PARAM_NAMES, FASE_VENDA, FASE_PERDA,
  diaAoLimparPeriodo,
} from '../screenParams.js';
import { CONTRACT_STATUS } from '../contracts.js';
import { SOLO_TRAINING } from '../professores.js';

const users = [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bruno' }];
const funis = [{ id: 'f1', name: 'Comercial' }, { id: 'f2', name: 'Vencidos' }];
const etapas = [{ id: 's1', name: 'Novo' }, { id: 's2', name: 'Em negociação' }];
const situacoes = [CONTRACT_STATUS.ATIVO, CONTRACT_STATUS.A_VENCER, 'sem_contrato'];
const HOJE = '2026-09';

const dash = { currentKey: HOJE, users };
const ler = (tela, q, ctx) => readScreenParams(tela, q, ctx);
const montar = (tela, v, ctx) => screenParamsQuery(tela, v, ctx);
// Ida e volta: montar o que foi lido devolve a mesma query normalizada.
const volta = (tela, q, ctx) => montar(tela, ler(tela, q, ctx), ctx);

describe('tabela de parâmetros', () => {
  it('cada tela tem os nomes do spec, e nenhum deles é invite, t ou ref', () => {
    expect(SCREEN_PARAM_NAMES.dashOperacional).toEqual(['mes', 'comparar', 'comparar-com', 'pessoa']);
    expect(SCREEN_PARAM_NAMES.dashCrm).toEqual(['mes', 'comparar', 'comparar-com', 'pessoa', 'funil']);
    expect(SCREEN_PARAM_NAMES.dashGerencial).toEqual(['mes', 'comparar', 'comparar-com']);
    expect(SCREEN_PARAM_NAMES.kanban).toEqual(['funil', 'resp', 'atraso']);
    expect(SCREEN_PARAM_NAMES.clientes).toEqual(['sit', 'resp']);
    expect(SCREEN_PARAM_NAMES.leads).toEqual(['funil', 'fase', 'resp', 'atraso', 'quente']);
    expect(SCREEN_PARAM_NAMES.aulas).toEqual(['dia', 'de', 'ate', 'resp', 'prof']);
    expect(SCREEN_PARAM_NAMES.visitas).toEqual(['dia', 'de', 'ate', 'resp']);
    expect(SCREEN_PARAM_NAMES.dailyGoal).toEqual(['cat']);
    const proibidos = ['invite', 't', 'ref'];
    for (const nomes of Object.values(SCREEN_PARAM_NAMES)) {
      for (const n of nomes) expect(proibidos, n).not.toContain(n);
    }
  });

  it('o endereço curto da academia lê a mesma tabela do Operacional', () => {
    expect(SCREEN_PARAM_NAMES.dashboard).toEqual(SCREEN_PARAM_NAMES.dashOperacional);
    expect(ler('dashboard', '?mes=2026-08', dash).monthKey).toBe('2026-08');
  });

  it('tela sem filtro devolve objeto vazio e query vazia', () => {
    for (const tela of ['settings', 'ficha', 'superadmin', 'xyz']) {
      expect(ler(tela, '?mes=2026-08', dash), tela).toEqual({});
      expect(montar(tela, { monthKey: '2026-08' }, dash), tela).toBe('');
    }
  });

  it('endereço limpo devolve o padrão de cada tela', () => {
    expect(ler('dashOperacional', '', dash)).toEqual({ monthKey: HOJE, compareOn: true, compareKey: null, person: 'all' });
    expect(ler('clientes', '', { users, situacoes, podeResp: true, respPadrao: [] })).toEqual({ status: [], resp: [] });
    expect(ler('dailyGoal', '', {})).toEqual({ cat: 'all' });
  });

  it('o padrão nunca é escrito no endereço', () => {
    expect(montar('dashOperacional', ler('dashOperacional', '', dash), dash)).toBe('');
    expect(montar('clientes', ler('clientes', '', { users, situacoes, podeResp: true, respPadrao: [] }), { users, situacoes, podeResp: true, respPadrao: [] })).toBe('');
    expect(montar('dailyGoal', { cat: 'all' }, {})).toBe('');
  });
});

describe('mês, comparativo e pessoa', () => {
  it('mês dentro da janela de 12 meses vale, e fora dela cai no mês de hoje', () => {
    expect(ler('dashOperacional', '?mes=2026-08', dash).monthKey).toBe('2026-08');
    expect(ler('dashOperacional', '?mes=2025-10', dash).monthKey).toBe('2025-10');
    for (const m of ['2025-09', '2026-10', '2023-05', 'banana', '2026-13', '']) {
      expect(ler('dashOperacional', `?mes=${m}`, dash).monthKey, m).toBe(HOJE);
    }
  });

  it('comparar só é escrito desligado, e qualquer outro valor liga', () => {
    expect(ler('dashOperacional', '?comparar=0', dash).compareOn).toBe(false);
    for (const v of ['1', 'sim', '']) expect(ler('dashOperacional', `?comparar=${v}`, dash).compareOn, v).toBe(true);
    expect(montar('dashOperacional', { ...ler('dashOperacional', '', dash), compareOn: false }, dash)).toBe('?comparar=0');
  });

  it('comparar-com aceita mês comparável e ignora o resto', () => {
    const ctx = { ...dash };
    expect(ler('dashOperacional', '?comparar-com=2026-07', ctx).compareKey).toBe('2026-07');
    for (const m of ['2026-09', '2026-11', 'banana']) {
      expect(ler('dashOperacional', `?comparar-com=${m}`, ctx).compareKey, m).toBeNull();
    }
  });

  it('comparar-com do Gerencial passa pela peneira dos meses com venda', () => {
    const ctx = { currentKey: HOJE, mesesComparaveis: () => ['2026-07', '2026-05'] };
    expect(ler('dashGerencial', '?comparar-com=2026-07', ctx).compareKey).toBe('2026-07');
    expect(ler('dashGerencial', '?comparar-com=2026-05', ctx).compareKey).toBe('2026-05');
    expect(ler('dashGerencial', '?comparar-com=2026-08', ctx).compareKey).toBeNull();
    expect(volta('dashGerencial', '?comparar-com=2026-08', ctx)).toBe('');
  });

  it('o mês da comparação que já é o padrão da tela não é escrito', () => {
    // O padrão é sempre o primeiro da lista de comparáveis: o mês anterior no
    // Operacional e no CRM, o mês anterior COM VENDA no Gerencial. Escolher na
    // barra justamente a opção que já estava marcada não pode sujar o endereço.
    const v = ler('dashOperacional', '?mes=2026-08', dash);
    expect(montar('dashOperacional', { ...v, compareKey: '2026-07' }, dash)).toBe('?mes=2026-08');
    expect(montar('dashOperacional', { ...v, compareKey: '2026-06' }, dash)).toBe('?mes=2026-08&comparar-com=2026-06');
    const ger = { currentKey: HOJE, mesesComparaveis: () => ['2026-07', '2026-05'] };
    expect(montar('dashGerencial', { monthKey: HOJE, compareOn: true, compareKey: '2026-07' }, ger)).toBe('');
    expect(montar('dashGerencial', { monthKey: HOJE, compareOn: true, compareKey: '2026-05' }, ger)).toBe('?comparar-com=2026-05');
  });

  it('comparar-com é peneirado contra o mês exibido que veio na mesma query', () => {
    expect(ler('dashOperacional', '?mes=2026-05&comparar-com=2026-04', dash).compareKey).toBe('2026-04');
    expect(ler('dashOperacional', '?mes=2026-05&comparar-com=2026-08', dash).compareKey).toBeNull();
  });

  it('pessoa que não está na lista cai em todos, inclusive no Operacional', () => {
    for (const tela of ['dashOperacional', 'dashCrm']) {
      expect(ler(tela, '?pessoa=u1', { ...dash, funis }).person, tela).toBe('u1');
      expect(ler(tela, '?pessoa=sumiu', { ...dash, funis }).person, tela).toBe('all');
      expect(volta(tela, '?pessoa=sumiu', { ...dash, funis }), tela).toBe('');
    }
  });

  it('funil do CRM é recorte e cai em todos quando o funil sumiu', () => {
    const ctx = { ...dash, funis };
    expect(ler('dashCrm', '?funil=f1', ctx).funnel).toBe('f1');
    expect(ler('dashCrm', '?funil=apagado', ctx).funnel).toBe('all');
    expect(montar('dashCrm', { ...ler('dashCrm', '', ctx), funnel: 'f1' }, ctx)).toBe('?funil=f1');
  });

  it('a ordem dos parâmetros é a da tabela, não a de quem escreveu', () => {
    // 2026-06, e não 2026-07: o mês anterior ao exibido é o padrão e some.
    const v = { monthKey: '2026-08', compareOn: false, compareKey: '2026-06', person: 'u2' };
    expect(montar('dashOperacional', v, dash)).toBe('?mes=2026-08&comparar=0&comparar-com=2026-06&pessoa=u2');
  });
});

describe('responsável, nos três estados', () => {
  const kanban = { users, funis, podeResp: true, respPadrao: ['u2'], funilPadrao: 'f1' };

  it('ausente é o padrão do papel, vazio é toda a equipe, e com ids é a lista', () => {
    expect(ler('kanban', '', kanban).resp).toEqual(['u2']);
    expect(ler('kanban', '?resp=', kanban).resp).toEqual([]);
    expect(ler('kanban', '?resp=u1,u2', kanban).resp).toEqual(['u1', 'u2']);
  });

  it('a lista vazia só é escrita quando o padrão do papel não é vazia', () => {
    expect(montar('kanban', { ...ler('kanban', '', kanban), resp: [] }, kanban)).toBe('?funil=f1&resp=');
    const gestor = { ...kanban, respPadrao: [] };
    expect(montar('kanban', { ...ler('kanban', '', gestor), resp: [] }, gestor)).toBe('?funil=f1');
  });

  it('id de quem saiu é descartado, e só o padrão volta quando nenhum sobra', () => {
    expect(ler('kanban', '?resp=u1,sumiu', kanban).resp).toEqual(['u1']);
    expect(ler('kanban', '?resp=sumiu', kanban).resp).toEqual(['u2']);
  });

  it('quem não vê o controle não é recortado pelo endereço, e o parâmetro não é escrito', () => {
    const consultor = { users, situacoes, podeResp: false, respPadrao: [] };
    expect(ler('clientes', '?resp=u1', consultor).resp).toEqual([]);
    expect(montar('clientes', { status: [], resp: ['u1'] }, consultor)).toBe('');
  });
});

describe('listas de valor fechado', () => {
  const cli = { users, situacoes, podeResp: true, respPadrao: [] };
  const lea = { users, funis, etapas, podeResp: true, respPadrao: [], funilPadrao: 'f1' };

  it('situação aceita só os valores do catálogo de contrato', () => {
    expect(ler('clientes', '?sit=ativo,a_vencer', cli).status).toEqual(['ativo', 'a_vencer']);
    expect(ler('clientes', '?sit=ativo,banana', cli).status).toEqual(['ativo']);
    expect(ler('clientes', '?sit=banana', cli).status).toEqual([]);
    expect(montar('clientes', { status: ['ativo', 'a_vencer'], resp: [] }, cli)).toBe('?sit=ativo,a_vencer');
  });

  it('fase viaja como código e a tela recebe o nome da etapa', () => {
    expect(ler('leads', '?fase=s1', lea).stage).toEqual(['Novo']);
    expect(ler('leads', `?fase=s2,${FASE_VENDA},${FASE_PERDA}`, lea).stage).toEqual(['Em negociação', 'Venda', 'Perda']);
    expect(montar('leads', { ...ler('leads', '', lea), stage: ['Novo', 'Venda'] }, lea)).toBe(`?funil=f1&fase=s1,${FASE_VENDA}`);
  });

  it('etapa que saiu do funil some do filtro, e renomear a etapa não quebra o link', () => {
    expect(ler('leads', '?fase=apagada', lea).stage).toEqual([]);
    const renomeada = { ...lea, etapas: [{ id: 's1', name: 'Primeiro contato' }] };
    expect(ler('leads', '?fase=s1', renomeada).stage).toEqual(['Primeiro contato']);
  });

  it('categoria da Meta aceita as sete do dia, amanhã e todos', () => {
    expect(ler('dailyGoal', '?cat=renovacao', {}).cat).toBe('renovacao');
    expect(ler('dailyGoal', '?cat=amanha', {}).cat).toBe('tomorrow');
    expect(ler('dailyGoal', '?cat=banana', {}).cat).toBe('all');
    expect(montar('dailyGoal', { cat: 'tomorrow' }, {})).toBe('?cat=amanha');
    expect(montar('dailyGoal', { cat: 'vencido' }, {})).toBe('?cat=vencido');
  });

  it('booleano só é escrito ligado', () => {
    expect(ler('leads', '?atraso=1&quente=1', lea).overdue).toBe(true);
    expect(ler('leads', '?atraso=0', lea).overdue).toBe(false);
    expect(montar('leads', { ...ler('leads', '', lea), overdue: true, hot: true }, lea)).toBe('?funil=f1&atraso=1&quente=1');
  });
});

describe('funil das telas de lista', () => {
  const lea = { users, funis, etapas, podeResp: true, respPadrao: [], funilPadrao: 'f1' };

  it('sem funil no endereço vale o último funil usado', () => {
    expect(ler('leads', '', lea).funnel).toBe('f1');
    expect(ler('leads', '?funil=f2', lea).funnel).toBe('f2');
    expect(ler('leads', '?funil=apagado', lea).funnel).toBe('f1');
  });

  it('o funil válido é sempre escrito, porque o padrão dele é de cada pessoa', () => {
    expect(montar('leads', ler('leads', '', lea), lea)).toBe('?funil=f1');
    expect(montar('kanban', ler('kanban', '?funil=f2', { ...lea, funilPadrao: 'f1' }), { ...lea, funilPadrao: 'f1' })).toBe('?funil=f2');
  });

  it('sem funil nenhum na academia o parâmetro não é escrito', () => {
    const vazio = { ...lea, funis: [], funilPadrao: null };
    expect(ler('leads', '?funil=f1', vazio).funnel).toBeNull();
    expect(montar('leads', ler('leads', '', vazio), vazio)).toBe('');
  });

  it('o funil da tela de lista é legível de fora, para o cadastro rápido não abrir no funil de antes', () => {
    const ctx = { funis, funilPadrao: 'f1' };
    expect(funnelFromSearch('kanban', '?funil=f2', ctx)).toBe('f2');
    expect(funnelFromSearch('leads', '?funil=f2&atraso=1', ctx)).toBe('f2');
    expect(funnelFromSearch('leads', '?funil=apagado', ctx)).toBe('f1');
    expect(funnelFromSearch('leads', '', ctx)).toBe('f1');
    // Tela sem funil de lista (o do CRM é recorte do dashboard, não é o mesmo
    // estado) e tela sem parâmetro nenhum devolvem o último funil usado.
    for (const tela of ['dashCrm', 'clientes', 'ficha', 'xyz']) {
      expect(funnelFromSearch(tela, '?funil=f2', ctx), tela).toBe('f1');
    }
    expect(funnelFromSearch('kanban', '?funil=f2', { funis, funilPadrao: null })).toBe('f2');
    expect(funnelFromSearch('kanban', '', {})).toBeNull();
  });
});

describe('dia e período de Aulas e Visitas', () => {
  const aulas = { users, podeResp: true, respPadrao: [], professores: [{ id: 'p1' }], temAndamento: true };
  const visitas = { users, podeResp: true, respPadrao: [], temAndamento: false };

  it('atalho de dia traduz o código do endereço para o id da tela', () => {
    const pares = [['hoje', 'today'], ['ontem', 'yesterday'], ['amanha', 'tomorrow'], ['andamento', 'ongoing']];
    for (const [cod, id] of pares) expect(ler('aulas', `?dia=${cod}`, aulas).day, cod).toBe(id);
    expect(ler('aulas', '?dia=banana', aulas).day).toBe('today');
  });

  it('em andamento só existe em Aulas', () => {
    expect(ler('visitas', '?dia=andamento', visitas).day).toBe('today');
    expect(montar('visitas', { day: 'ongoing', de: null, ate: null, resp: [] }, visitas)).toBe('');
  });

  it('período válido ganha do atalho de dia', () => {
    const v = ler('aulas', '?dia=ontem&de=2026-09-01&ate=2026-09-20', aulas);
    expect([v.day, v.de, v.ate]).toEqual([null, '2026-09-01', '2026-09-20']);
    expect(montar('aulas', v, aulas)).toBe('?de=2026-09-01&ate=2026-09-20');
  });

  it('período torto cai fora inteiro e a tela abre no dia padrão', () => {
    const tortos = [
      '?de=2026-09-20&ate=2026-09-01',
      '?de=2026-08-01&ate=2026-09-20',
      '?de=2026-09-01',
      '?ate=2026-09-20',
      '?de=banana&ate=2026-09-20',
      '?de=2026-09-31&ate=2026-10-01',
    ];
    for (const q of tortos) {
      const v = ler('aulas', q, aulas);
      expect([v.day, v.de, v.ate], q).toEqual(['today', null, null]);
      expect(volta('aulas', q, aulas), q).toBe('');
    }
  });

  it('o teto é de 30 dias, e trinta dias certos passam', () => {
    expect(ler('aulas', '?de=2026-09-01&ate=2026-10-01', aulas).de).toBe('2026-09-01');
    expect(ler('aulas', '?de=2026-09-01&ate=2026-10-02', aulas).de).toBeNull();
  });

  it('a distância até hoje não é peneirada: o período de janeiro passado abre', () => {
    // Só a largura tem teto. Antes da entrega o gestor digitava qualquer janela
    // de 30 dias, em qualquer distância, e a tela abria; com o filtro no
    // endereço isso continua valendo.
    expect(ler('aulas', '?de=2026-01-05&ate=2026-01-30', aulas).de).toBe('2026-01-05');
    expect(ler('aulas', '?de=2027-09-01&ate=2027-09-30', aulas).ate).toBe('2027-09-30');
  });

  it('professor aceita os do catálogo e o treina sozinho, e some para quem não filtra', () => {
    expect(ler('aulas', `?prof=p1,${SOLO_TRAINING}`, aulas).prof).toEqual(['p1', SOLO_TRAINING]);
    expect(ler('aulas', '?prof=p9', aulas).prof).toEqual([]);
    expect(ler('aulas', '?prof=p1,apagado', aulas).prof).toEqual(['p1']);
    expect(ler('aulas', '?prof=p1', { ...aulas, podeResp: false }).prof).toEqual([]);
    expect(volta('aulas', `?prof=p1,${SOLO_TRAINING}`, aulas)).toBe(`?prof=p1,${SOLO_TRAINING}`);
  });
});

describe('ida e volta de tudo', () => {
  it('ler e montar de novo devolve a mesma query, para toda tela', () => {
    const ctx = {
      currentKey: HOJE, users, funis, etapas, situacoes, professores: [{ id: 'p1' }],
      podeResp: true, respPadrao: [], funilPadrao: 'f1', temAndamento: true,
    };
    const casos = [
      ['dashOperacional', '?mes=2026-08&comparar=0&comparar-com=2026-06&pessoa=u1'],
      ['dashCrm', '?mes=2026-08&pessoa=u1&funil=f2'],
      ['dashGerencial', '?mes=2026-08&comparar=0'],
      ['kanban', '?funil=f2&resp=u1&atraso=1'],
      ['clientes', '?sit=ativo&resp=u1,u2'],
      ['leads', '?funil=f1&fase=s1&resp=u2&atraso=1&quente=1'],
      ['aulas', '?de=2026-09-01&ate=2026-09-10&resp=u1&prof=p1'],
      ['visitas', '?dia=ontem&resp=u1'],
      ['dailyGoal', '?cat=atrasado'],
    ];
    // Só o Gerencial peneira o mês da comparação pelos meses com venda; as
    // outras telas usam os doze meses anteriores ao mês exibido.
    for (const [tela, q] of casos) {
      const c = tela === 'dashGerencial' ? { ...ctx, mesesComparaveis: () => ['2026-07', '2026-05'] } : ctx;
      expect(volta(tela, q, c), tela).toBe(q);
    }
  });

  it('valor com caractere especial volta legível, e a vírgula não vira código', () => {
    const ctx = { users: [{ id: 'a b' }, { id: 'c&d' }], podeResp: true, respPadrao: [], situacoes };
    const q = montar('clientes', { status: [], resp: ['a b', 'c&d'] }, ctx);
    expect(q).toBe('?resp=a%20b,c%26d');
    expect(ler('clientes', q, ctx).resp).toEqual(['a b', 'c&d']);
  });

  it('nome que a tela não conhece é ignorado, e some na próxima montagem', () => {
    expect(ler('dailyGoal', '?cat=vencido&mes=2026-08&invite=x', {})).toEqual({ cat: 'vencido' });
    expect(volta('dailyGoal', '?cat=vencido&mes=2026-08&invite=x', {})).toBe('?cat=vencido');
  });
});

describe('contrato do contexto dos três dashboards', () => {
  // A tela monta a lista de meses com 12 opções a partir do mês corrente
  // (Array.from({length: 12}, (_, i) => addMonthsToKey(currentKey, -i))) e a
  // seta trava em addMonthsToKey(currentKey, -11). O endereço obedece à mesma
  // janela, senão um link abriria um mês que o seletor não sabe mostrar.
  it('a janela do mês do endereço é a mesma lista de 12 meses da barra', () => {
    const doze = Array.from({ length: 12 }, (_, i) => {
      const [a, m] = HOJE.split('-').map(Number);
      const d = new Date(a, m - 1 - i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    for (const m of doze) expect(ler('dashOperacional', `?mes=${m}`, dash).monthKey, m).toBe(m);
    const antesDaLista = doze[doze.length - 1];
    expect(ler('dashOperacional', `?mes=${antesDaLista}`, dash).monthKey).toBe(antesDaLista);
  });

  it('trocar de mês limpa o mês da comparação, como a barra já fazia', () => {
    const v = ler('dashOperacional', '?mes=2026-08&comparar-com=2026-07', dash);
    expect(montar('dashOperacional', { ...v, monthKey: '2026-06', compareKey: null }, dash)).toBe('?mes=2026-06');
  });

  it('o Gerencial sem nenhum mês com venda não escreve comparativo nenhum', () => {
    const ctx = { currentKey: HOJE, mesesComparaveis: () => [] };
    expect(ler('dashGerencial', '?comparar-com=2026-07', ctx).compareKey).toBeNull();
    expect(montar('dashGerencial', { monthKey: HOJE, compareOn: true, compareKey: '2026-07' }, ctx)).toBe('');
  });

  it('o Gerencial não tem filtro de pessoa, e um pessoa no endereço dele é ignorado', () => {
    expect(ler('dashGerencial', '?pessoa=u1', { currentKey: HOJE })).toEqual({ monthKey: HOJE, compareOn: true, compareKey: null });
  });

  it('o funil do CRM é o recorte do dashboard e não conhece o último funil usado', () => {
    const ctx = { ...dash, funis, funilPadrao: 'f2' };
    expect(ler('dashCrm', '', ctx).funnel).toBe('all');
    expect(montar('dashCrm', ler('dashCrm', '', ctx), ctx)).toBe('');
  });

  it('desligar o comparativo e escolher pessoa cabem na mesma query', () => {
    expect(montar('dashCrm', { monthKey: HOJE, compareOn: false, compareKey: null, person: 'u1', funnel: 'all' }, { ...dash, funis }))
      .toBe('?comparar=0&pessoa=u1');
  });

  it('clicar na linha da pessoa e clicar de novo limpa: os dois estados cabem no endereço', () => {
    const ctx = { ...dash, funis };
    const escolhida = { ...ler('dashCrm', '', ctx), person: 'u2' };
    expect(montar('dashCrm', escolhida, ctx)).toBe('?pessoa=u2');
    expect(montar('dashCrm', { ...escolhida, person: 'all' }, ctx)).toBe('');
  });

  it('pessoa desligada no meio da sessão some do endereço na próxima escolha', () => {
    const antes = { ...dash, users: [...users, { id: 'u9' }] };
    const depois = dash;
    const v = ler('dashOperacional', '?pessoa=u9', antes);
    expect(v.person).toBe('u9');
    expect(montar('dashOperacional', v, depois)).toBe('');
    expect(ler('dashOperacional', '?pessoa=u9', depois).person).toBe('all');
  });

  it('o endereço curto da academia e o endereço longo do Operacional leem igual', () => {
    const q = '?mes=2026-08&comparar=0&pessoa=u1';
    expect(ler('dashboard', q, dash)).toEqual(ler('dashOperacional', q, dash));
  });
});

describe('contrato do contexto do Pipeline e de Clientes', () => {
  const kanban = { users, funis, podeResp: true, respPadrao: ['u2'], funilPadrao: 'f1' };
  const gestorNoKanban = { ...kanban, respPadrao: [] };

  it('o consultor abre na própria carteira e o gestor na equipe, sem nada no endereço', () => {
    expect(ler('kanban', '', kanban).resp).toEqual(['u2']);
    expect(ler('kanban', '', gestorNoKanban).resp).toEqual([]);
  });

  it('o consultor que abre o board para a equipe inteira fica com isso no endereço', () => {
    expect(montar('kanban', { ...ler('kanban', '', kanban), resp: [] }, kanban)).toBe('?funil=f1&resp=');
  });

  it('limpar devolve o board ao padrão do papel, e o endereço só guarda o funil', () => {
    const limpo = { funnel: 'f1', resp: ['u2'], overdue: false };
    expect(montar('kanban', limpo, kanban)).toBe('?funil=f1');
  });

  it('o Pipeline não tem fase, situação nem quente no endereço', () => {
    expect(ler('kanban', '?fase=s1&sit=ativo&quente=1', kanban)).toEqual({ funnel: 'f1', resp: ['u2'], overdue: false });
  });

  it('Clientes junta situação e responsável na mesma query, na ordem da tabela', () => {
    const ctx = { users, situacoes, podeResp: true, respPadrao: [] };
    expect(montar('clientes', { status: ['ativo', 'a_vencer'], resp: ['u1'] }, ctx)).toBe('?sit=ativo,a_vencer&resp=u1');
  });

  it('link de gestor aberto por consultor mostra a lista inteira em Clientes', () => {
    const consultor = { users, situacoes, podeResp: false, respPadrao: [] };
    const v = ler('clientes', '?sit=ativo&resp=u1', consultor);
    expect(v).toEqual({ status: ['ativo'], resp: [] });
    expect(montar('clientes', v, consultor)).toBe('?sit=ativo');
  });

  it('sem contrato é uma situação de tela, não de contrato, e passa pelo endereço', () => {
    const ctx = { users, situacoes, podeResp: true, respPadrao: [] };
    expect(ler('clientes', '?sit=sem_contrato', ctx).status).toEqual(['sem_contrato']);
  });

  it('o filtro de plano não existe no endereço nesta entrega', () => {
    const ctx = { users, situacoes, podeResp: true, respPadrao: [] };
    expect(ler('clientes', '?plano=Clube%2B', ctx)).toEqual({ status: [], resp: [] });
  });
});

describe('contrato do contexto de Todos os leads e da Meta', () => {
  // A tela passa as etapas como FUNÇÃO do funil escolhido, porque a lista de
  // etapas depende do funil e o funil é lido antes da fase na mesma passada.
  const porFunil = { f1: [{ id: 's1', name: 'Novo' }], f2: [{ id: 's9', name: 'Cobrança' }] };
  const lea = {
    users, funis, situacoes, podeResp: true, respPadrao: [], funilPadrao: 'f1',
    etapas: (fid) => porFunil[fid] || [],
  };

  it('a fase é peneirada contra as etapas do funil que veio na mesma query', () => {
    expect(ler('leads', '?funil=f1&fase=s1', lea).stage).toEqual(['Novo']);
    expect(ler('leads', '?funil=f2&fase=s1', lea).stage).toEqual([]);
    expect(ler('leads', '?funil=f2&fase=s9', lea).stage).toEqual(['Cobrança']);
  });

  it('venda e perda valem em qualquer funil, porque não são etapa cadastrada', () => {
    expect(ler('leads', `?funil=f2&fase=${FASE_VENDA},${FASE_PERDA}`, lea).stage).toEqual(['Venda', 'Perda']);
  });

  it('trocar de funil e limpar a fase cabem numa navegação só', () => {
    const antes = ler('leads', '?funil=f1&fase=s1&atraso=1', lea);
    expect(montar('leads', { ...antes, funnel: 'f2', stage: [] }, lea)).toBe('?funil=f2&atraso=1');
  });

  it('fase de um funil que não é mais o escolhido some sozinha na montagem', () => {
    expect(montar('leads', { funnel: 'f2', stage: ['Novo'], resp: [], overdue: false, hot: false }, lea)).toBe('?funil=f2');
  });

  it('quente e atraso convivem com a fase, na ordem da tabela', () => {
    expect(montar('leads', { funnel: 'f1', stage: ['Novo'], resp: ['u1'], overdue: true, hot: true }, lea))
      .toBe('?funil=f1&fase=s1&resp=u1&atraso=1&quente=1');
  });

  it('o responsável de Todos os leads também é de gestor', () => {
    const consultor = { ...lea, podeResp: false };
    expect(ler('leads', '?resp=u1', consultor).resp).toEqual([]);
  });

  it('etapa cadastrada com o nome de uma coluna terminal não rouba o código dela', () => {
    // O catálogo de etapas é livre, e a tela já trata as duas como a mesma
    // opção (o filtro guarda o NOME). No endereço o nome vira sempre o código
    // curto, que não some quando a etapa é apagada.
    const comVenda = { ...lea, etapas: () => [{ id: 'sX', name: 'Venda' }] };
    expect(montar('leads', { funnel: 'f1', stage: ['Venda'], resp: [], overdue: false, hot: false }, comVenda))
      .toBe(`?funil=f1&fase=${FASE_VENDA}`);
    expect(ler('leads', `?funil=f1&fase=${FASE_VENDA}`, comVenda).stage).toEqual(['Venda']);
    expect(ler('leads', '?funil=f1&fase=sX', comVenda).stage).toEqual(['Venda']);
  });

  it('a categoria da Meta cobre as sete do dia, e cada uma volta pelo mesmo código', () => {
    const sete = ['novo_24h', 'visita_hoje', 'aula_hoje', 'contato_hoje', 'atrasado', 'renovacao', 'vencido'];
    for (const slug of sete) {
      expect(ler('dailyGoal', `?cat=${slug}`, {}).cat, slug).toBe(slug);
      expect(volta('dailyGoal', `?cat=${slug}`, {}), slug).toBe(`?cat=${slug}`);
    }
  });

  it('a visão Equipe da Meta ficou fora desta entrega e não tem parâmetro', () => {
    expect(SCREEN_PARAM_NAMES.dailyGoal).toEqual(['cat']);
    expect(ler('dailyGoal', '?visao=equipe&dia=14', {})).toEqual({ cat: 'all' });
  });
});

describe('contrato do contexto de Aulas e Visitas', () => {
  const aulas = { users, podeResp: true, respPadrao: [], professores: [{ id: 'p1' }, { id: 'p2' }], temAndamento: true };
  const visitas = { users, podeResp: true, respPadrao: [], temAndamento: false };

  it('o atalho de dia padrão é hoje e não é escrito', () => {
    expect(ler('visitas', '', visitas)).toEqual({ day: 'today', de: null, ate: null, resp: [] });
    expect(montar('visitas', ler('visitas', '', visitas), visitas)).toBe('');
  });

  it('escolher um dia apaga o período, e escolher período apaga o dia', () => {
    // As duas navegações que a tela faz: clicar numa aba de dia e aplicar o
    // período no popover. Cada uma escreve um lado do par e apaga o outro na
    // mesma escrita, então o endereço nunca fica com os dois.
    const comPeriodo = ler('aulas', '?de=2026-09-01&ate=2026-09-10', aulas);
    expect(montar('aulas', { ...comPeriodo, day: 'yesterday', de: null, ate: null }, aulas)).toBe('?dia=ontem');
    const comDia = ler('aulas', '?dia=ontem', aulas);
    expect(montar('aulas', { ...comDia, day: null, de: '2026-09-01', ate: '2026-09-10' }, aulas))
      .toBe('?de=2026-09-01&ate=2026-09-10');
  });

  it('limpar o período devolve hoje, e guarda a aba de dia quando havia uma', () => {
    // Com período ativo o dia é nulo (o período ganha), então cai em Hoje; sem
    // período, a aba onde a pessoa está continua acesa.
    expect(diaAoLimparPeriodo(null)).toBe('today');
    expect(diaAoLimparPeriodo('ongoing')).toBe('ongoing');
    expect(diaAoLimparPeriodo('yesterday')).toBe('yesterday');
    const v = ler('aulas', '?de=2026-09-01&ate=2026-09-10&resp=u1', aulas);
    expect(montar('aulas', { ...v, de: null, ate: null, day: diaAoLimparPeriodo(v.day) }, aulas)).toBe('?resp=u1');
  });

  it('o consultor não é recortado por responsável nem por professor', () => {
    // O botão de filtros inteiro é de gestor nesta tela, então um link de
    // gestor não pode prender o consultor num recorte que ele não vê nem
    // consegue limpar. Vale nas duas direções: some na leitura e some na
    // montagem, então o primeiro clique dele já limpa o endereço.
    const consultor = { ...aulas, podeResp: false };
    const v = ler('aulas', '?resp=u1&prof=p1&dia=ontem', consultor);
    expect([v.resp, v.prof, v.day]).toEqual([[], [], 'yesterday']);
    expect(montar('aulas', { ...v, resp: ['u1'], prof: ['p1'] }, consultor)).toBe('?dia=ontem');
    const semResp = ler('visitas', '?resp=u1&dia=ontem', { ...visitas, podeResp: false });
    expect([semResp.resp, semResp.day]).toEqual([[], 'yesterday']);
  });

  it('professor e responsável juntos, na ordem da tabela', () => {
    expect(montar('aulas', { day: 'today', de: null, ate: null, resp: ['u1'], prof: ['p1', SOLO_TRAINING] }, aulas))
      .toBe(`?resp=u1&prof=p1,${SOLO_TRAINING}`);
  });
});
