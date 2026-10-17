// Leads parados: o retrato de agora dos leads em aberto sem próximo passo, com
// contato atrasado ou sem registro há mais de N dias, cada lead uma vez na
// lista. O em aberto e o sem próximo passo são os da carteira de agora do painel
// CRM (metricsOf, now).
import { describe, it, expect } from 'vitest';
import { paradosReport, stageSinceOf, PARADOS_COLUMNS } from '../relatorios/leads/parados.js';
import { metricsOf } from '../crm/metrics.js';
import { OTHERS_ID } from '../crm/scope.js';
import { kanbanSilence } from '../kanban.js';
import { makeCtx, L, D, NOW, s2, s4, s5, a2, a3 } from './fixtures/crmCtx.js';

// Agora: 14/09, segunda, meio-dia.
// x1: da Ana, com o contato atrasado desde 10/09 e delegado ao Diego; o atraso fica com a Ana.
const X1 = L('x1', {
  createdAt: D(9, 1), nextFollowUp: D(9, 10), nextFollowUpOwnerId: 'diego', lastInteractionAt: D(9, 12, 9), statusEnteredAt: D(9, 5),
});
// x2: cadastrado hoje cedo e sem próximo contato: a Meta ainda o cobra como Novo lead 24h.
const X2 = L('x2', { createdAt: D(9, 14, 8), nextFollowUp: null });
// x3: cliente, fora dos leads em aberto.
const X3 = L('x3', { status: 'Venda', isConverted: true, nextFollowUp: null });
// O a2 com o último registro gravado no lead, 11 dias atrás.
const A2 = { ...a2, lastInteractionAt: D(9, 3, 12) };
const ctxOf = () => {
  const c = makeCtx();
  return { ...c, liveLeads: [s2, s4, s5, A2, a3, X1, X2, X3], interactions: c.months['2026-09'].interactions, sources: [] };
};
// O ctxOf com mais leads em aberto, para as bordas que os leads de cima não têm.
const ctxCom = (...extra) => {
  const c = ctxOf();
  return { ...c, liveLeads: [...c.liveLeads, ...extra] };
};
const rel = (ctx, extra = {}) => paradosReport(ctx, extra);
const valores = (r) => r.tiles.map((t) => [t.key, t.name, t.value]);

describe('Leads parados', () => {
  it('os três números e os leads em aberto agora', () => {
    const r = rel(ctxOf());
    expect(r.open).toBe(7);
    expect(valores(r)).toEqual([
      ['situacao:sem-proximo-passo', 'Sem próximo passo', 3],
      ['situacao:atrasado', 'Contato atrasado', 1],
      ['situacao:sem-registro', 'Sem registro há mais de 7 dias', 4],
    ]);
    // Cada lead entra uma vez: s2, s5 e a3 estão em dois números.
    expect(r.total).toBe(5);
  });

  it('a lista: quem está há mais dias sem registro primeiro, com a etapa, o último registro, o próximo contato e o consultor', () => {
    const r = rel(ctxOf());
    // Os dias são do calendário, como no card do Pipeline: o s5, com o último registro em 02/09 às 15h, está há 12 dias.
    expect(r.rows.map((x) => [x.id, x.quiet])).toEqual([['a3', 33], ['s5', 12], ['a2', 11], ['s2', 11], ['x1', 2]]);
    const x1 = r.rows.find((x) => x.id === 'x1');
    expect(x1).toMatchObject({ stage: 'Novo lead', stageDays: 9, lastAt: D(9, 12, 9), next: D(9, 10), late: 4, owner: 'Ana Ribeiro' });
    // O último registro vem das interações que chegam ao vivo quando o lead não tem o campo.
    expect(r.rows.find((x) => x.id === 's2').lastAt).toEqual(D(9, 3, 12));
    expect(r.rows.find((x) => x.id === 'a3')).toMatchObject({ lastAt: null, stageDays: null, next: null, late: 0 });

    // No mesmo número de dias, o nome desempata e depois o id. Os ids ficam fora da ordem dos nomes
    // e o 't9' entra antes do 't8', para a ordem só sair certa pela regra. Quem não tem nome é
    // "Sem nome" e fica depois.
    const parado11 = (id, name) => L(id, { name, nextFollowUp: null, lastInteractionAt: D(9, 3, 12) });
    const empate = rel(ctxCom(parado11('t7', 'Bia'), parado11('t9', 'Ana'), parado11('t8', 'Ana')));
    expect(empate.rows.map((x) => x.id)).toEqual(['a3', 's5', 't8', 't9', 't7', 'a2', 's2', 'x1']);

    // Lead sem nenhuma data (nem registro, nem cadastro): sem dias, e na lista por último.
    const semData = rel(ctxCom(L('v1', { createdAt: null, nextFollowUp: null }))).rows;
    expect(semData.at(-1)).toMatchObject({ id: 'v1', quiet: null, lastAt: null, stageDays: null });

    // O lead que o app monta sem data de cadastro (normalizeLeadDoc): createdAtMissing e createdAt com a hora da
    // carga. Os dias são desconhecidos, e não 0.
    const carregado = L('m1', { createdAt: NOW, createdAtMissing: true, nextFollowUp: null });
    expect(rel(ctxCom(carregado)).rows.at(-1)).toMatchObject({ id: 'm1', quiet: null, lastAt: null, stageDays: null });

    // Dias na etapa em dias de calendário, e não em períodos de 24 horas: da entrada de 12/09 às 22h
    // até 14/09 ao meio-dia são 2 dias no calendário e 1 de 24 horas. Entrar hoje dá 0.
    const entrou = (id, entered) => L(id, { nextFollowUp: null, statusEnteredAt: entered, lastInteractionAt: D(9, 14, 9) });
    const naEtapa = rel(ctxCom(entrou('e1', D(9, 12, 22)), entrou('e2', D(9, 14, 9)))).rows;
    expect(naEtapa.find((x) => x.id === 'e1')).toMatchObject({ stageDays: 2, quiet: 0 });
    expect(naEtapa.find((x) => x.id === 'e2')).toMatchObject({ stageDays: 0, quiet: 0 });
    // A entrada gravada no futuro (relógio do aparelho adiantado) fica em 0, nunca -1.
    expect(rel(ctxCom(entrou('e3', D(9, 15, 9)))).rows.find((x) => x.id === 'e3').stageDays).toBe(0);
  });

  it('o retrato leva o instante em que foi tirado, que a tela escreve ao lado do número', () => {
    expect(rel(ctxOf()).at).toEqual(NOW);
  });

  it('o corte de dias muda só o terceiro número, e a lista acompanha', () => {
    const r15 = rel(ctxOf(), { dias: 15 });
    expect(r15.tiles[2]).toMatchObject({ name: 'Sem registro há mais de 15 dias', value: 1 });
    // O a2 só estava parado pelo registro: com 15 dias ele sai da lista.
    expect(r15.rows.map((x) => x.id)).toEqual(['a3', 's5', 's2', 'x1']);
    expect(rel(ctxOf(), { dias: 3 }).tiles[2].value).toBe(4);
    expect([rel(ctxOf()).dias, r15.dias]).toEqual([7, 15]);

    // "Mais de N dias" é estrito: o lead com próximo contato e o último registro há exatamente 7 dias
    // só entra com o corte de 3 (ou de 6).
    const dia7 = L('c7', { nextFollowUp: D(9, 20), lastInteractionAt: D(9, 7, 12) });
    expect(rel(ctxCom(dia7)).rows.map((x) => x.id)).not.toContain('c7');
    expect(rel(ctxCom(dia7), { dias: 6 }).rows.map((x) => x.id)).toContain('c7');
    expect(rel(ctxCom(dia7), { dias: 3 }).tiles[2].value).toBe(5);

    // Os dias são os do rodapé do card do Pipeline (kanbanSilence): dias do calendário, e não períodos de 24
    // horas. O último registro de 06/09 às 18h visto em 14/09 ao meio-dia são 8 dias no calendário e 7 de 24
    // horas, então ele está em "mais de 7 dias". E 23h50 de ontem já é 1 dia, com a meia-noite no meio.
    const naoVeio = L('k1', { nextFollowUp: D(9, 20), lastInteractionAt: D(9, 6, 18) });
    const ontem = L('k2', { nextFollowUp: null, lastInteractionAt: D(9, 13, 23, 50) });
    const doCard = rel(ctxCom(naoVeio, ontem));
    expect(doCard.rows.find((x) => x.id === 'k1')).toMatchObject({ quiet: 8 });
    expect(doCard.tiles[2].value).toBe(5);
    expect(doCard.rows.find((x) => x.id === 'k2')).toMatchObject({ quiet: 1 });
    // Para todo lead com registro, o número da lista é o que o card escreve.
    const textoDoCard = (x) => (x.quiet === 0 ? 'contato hoje' : `${x.quiet}d sem contato`);
    doCard.rows.filter((x) => x.lastAt).forEach((x) => expect(kanbanSilence(x.lastAt, NOW).text, x.id).toBe(textoDoCard(x)));
  });

  it('o recorte filtra a lista: cada número e o consultor', () => {
    const ids = (recorte) => rel(ctxOf(), { recorte }).rows.map((x) => x.id);
    expect(ids('situacao:sem-proximo-passo')).toEqual(['a3', 's5', 's2']);
    expect(ids('situacao:atrasado')).toEqual(['x1']);
    expect(ids('situacao:sem-registro')).toEqual(['a3', 's5', 'a2', 's2']);
    expect(ids('consultor:ana')).toEqual(['a3', 'x1']);
    expect(rel(ctxOf(), { recorte: 'situacao:atrasado' }).cutLabel).toBe('Contato atrasado');
    expect(rel(ctxOf(), { recorte: 'consultor:diego' }).cutLabel).toBe('Consultor: Diego Santos');
    expect(rel(ctxOf(), { recorte: 'situacao:vieram' }).cut).toBeNull();

    // Quem saiu da equipe (o s5, dono 'ex') entra no recorte Outros pela chave da equipe, e não pelo id gravado.
    expect(ids(`consultor:${OTHERS_ID}`)).toEqual(['s5']);
    expect(rel(ctxOf(), { recorte: `consultor:${OTHERS_ID}` }).cutLabel).toBe('Consultor: Outros');
  });

  it('os consultores do recorte, com Outros para quem saiu da equipe', () => {
    expect(rel(ctxOf()).byOwner.map((x) => [x.name, x.count])).toEqual([['Ana Ribeiro', 2], ['Diego Santos', 2], ['Outros', 1]]);
  });

  it('filtros da barra: consultores, origem e funil', () => {
    expect(rel(ctxOf(), { userIds: ['diego'] }).rows.map((x) => x.id)).toEqual(['a2', 's2']);
    expect(rel(ctxOf(), { origem: 'Site' }).rows.map((x) => x.id)).toEqual(['a2']);
    expect(rel(ctxOf(), { funnelId: 'ind' }).rows.map((x) => x.id)).toEqual(['s2']);
  });

  it('desde quando o lead está na etapa: a entrada gravada, o cadastro de depois de 14/09/2026 ou nada', () => {
    expect(stageSinceOf({ statusEnteredAt: D(9, 5) })).toEqual(D(9, 5));
    expect(stageSinceOf({ createdAt: D(9, 20) })).toEqual(D(9, 20));
    expect(stageSinceOf({ createdAt: D(9, 2) })).toBeNull();
    expect(stageSinceOf({ createdAt: D(9, 20), createdAtMissing: true })).toBeNull();
    // A fronteira é o dia 14/09/2026, e não o instante das 18h10: os dias na etapa são do calendário, então a
    // troca sem registro de 14/09 antes das 18h10 cai no mesmo dia do cadastro. O dia inteiro vale, da
    // meia-noite em diante, e o fim do dia anterior não.
    expect(stageSinceOf({ createdAt: D(9, 14, 10) })).toEqual(D(9, 14, 10));
    expect(stageSinceOf({ createdAt: D(9, 14, 0) })).toEqual(D(9, 14, 0));
    expect(stageSinceOf({ createdAt: new Date(2026, 8, 13, 23, 59, 59) })).toBeNull();
    expect(stageSinceOf({ createdAt: D(9, 13, 23) })).toBeNull();
  });

  it('a planilha tem o contato, o CPF e as colunas da lista, com os dias à parte', () => {
    expect(PARADOS_COLUMNS.map((c) => c.label)).toEqual([
      'Nome', 'WhatsApp', 'Responsável do aluno', 'Telefone do responsável', 'CPF',
      'Etapa', 'Dias na etapa', 'Último registro', 'Dias sem registro', 'Próximo contato', 'Dias de atraso', 'Consultor',
    ]);
    const linhas = rel(ctxOf(), { recorte: 'consultor:ana' }).exportRows;
    expect(linhas).toEqual([
      {
        nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
        etapa: 'Novo lead', diasNaEtapa: 'antes de 14/09/2026', ultimoRegistro: 'Nenhum', diasSemRegistro: 33, proximoContato: '', diasAtraso: '', consultor: 'Ana Ribeiro',
      },
      {
        nome: 'Sem nome', whatsapp: '', responsavel: '', telefoneResponsavel: '', cpf: '',
        etapa: 'Novo lead', diasNaEtapa: 9, ultimoRegistro: '12/09/2026', diasSemRegistro: 2, proximoContato: '10/09/2026', diasAtraso: 4, consultor: 'Ana Ribeiro',
      },
    ]);

    // Zero é número, e não falta: entrou na etapa hoje e registrou hoje.
    const hoje = L('e2', { nextFollowUp: null, statusEnteredAt: D(9, 14, 9), lastInteractionAt: D(9, 14, 9) });
    const [, , zeros] = rel(ctxCom(hoje), { recorte: 'consultor:ana' }).exportRows;
    expect(zeros).toMatchObject({ diasNaEtapa: 0, ultimoRegistro: '14/09/2026', diasSemRegistro: 0, diasAtraso: '' });

    // Sem nenhuma data: dias em branco, e a etapa diz que é de antes da gravação.
    const [semData] = rel(ctxCom(L('v1', { createdAt: null, nextFollowUp: null })), { recorte: 'consultor:ana' }).exportRows.slice(-1);
    expect(semData).toMatchObject({ diasNaEtapa: 'antes de 14/09/2026', ultimoRegistro: 'Nenhum', diasSemRegistro: '' });
    const carregado = L('m1', { createdAt: NOW, createdAtMissing: true, nextFollowUp: null });
    const [semCadastro] = rel(ctxCom(carregado), { recorte: 'consultor:ana' }).exportRows.slice(-1);
    expect(semCadastro).toMatchObject({ diasNaEtapa: 'antes de 14/09/2026', ultimoRegistro: 'Nenhum', diasSemRegistro: '' });

    // O consultor de quem saiu da equipe e de quem não tem dono é o texto explícito, e não o nome do recorte (Outros).
    const semDono = L('o9', { consultantId: null, nextFollowUp: null });
    const fora = rel(ctxCom(semDono), { recorte: `consultor:${OTHERS_ID}` });
    expect(fora.rows.map((x) => [x.id, x.owner])).toEqual([['o9', 'Sem responsável'], ['s5', 'Fora da equipe']]);
    expect(fora.exportRows.map((x) => x.consultor)).toEqual(['Sem responsável', 'Fora da equipe']);
  });

  // O "Contato atrasado" é o Atrasado da Meta (isMetaOverdue): o lead novo sem
  // próximo passo conta já no dia em que a janela de 24h fecha, como na Meta e
  // no Operacional. Pelo overdueDaysOf, ele só aparecia no dia seguinte.
  it('o lead novo sem próximo passo é contato atrasado no dia em que a janela fecha', () => {
    const novo = L('n1', { createdAt: new Date(2026, 9, 17, 9, 0), nextFollowUp: null });
    const r = rel({ ...ctxOf(), now: new Date(2026, 9, 18, 15, 0), liveLeads: [novo] });
    expect(valores(r)).toEqual([
      ['situacao:sem-proximo-passo', 'Sem próximo passo', 1],
      ['situacao:atrasado', 'Contato atrasado', 1],
      ['situacao:sem-registro', 'Sem registro há mais de 7 dias', 0],
    ]);
    // Os dias de atraso só começam no dia seguinte, como no card da Meta.
    const filtrado = rel({ ...ctxOf(), now: new Date(2026, 9, 18, 15, 0), liveLeads: [novo] }, { recorte: 'situacao:atrasado' });
    expect(filtrado.rows.map((x) => [x.id, x.late])).toEqual([['n1', 0]]);
  });

  it('o em aberto e o sem próximo passo são os da carteira de agora do painel CRM, para cada pessoa e funil', () => {
    const ctx = ctxOf();
    for (const userId of [null, 'ana', 'diego']) {
      for (const funnelId of [null, 'ven', 'ind']) {
        const tag = `${userId} ${funnelId}`;
        const r = rel(ctx, { userIds: userId ? [userId] : [], funnelId });
        const { now } = metricsOf(ctx, { monthKey: '2026-09', userId, funnelId });
        expect([r.open, r.tiles[0].value], tag).toEqual([now.total, now.noNext]);
      }
    }
  });
});
