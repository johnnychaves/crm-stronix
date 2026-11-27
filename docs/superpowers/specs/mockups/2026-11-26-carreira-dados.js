// Dados inventados dos mockups do plano de carreira configurável (2026-11-26-carreira-*.html).
// As três trilhas que já vêm prontas, com as metas da spec. Nomes de pessoas são fictícios.
window.CARREIRA = {
  numeros: {
    renovacao: { nome: 'Renovação da carteira', texto: 'Dos alunos cujo contrato venceu, quantos renovaram.', un: '%' },
    nps: { nome: 'Nota dos alunos', texto: 'Média da pergunta principal da pesquisa, de 0 a 10.', un: 'ou mais' },
    conversao: { nome: 'Conversão em matrícula', texto: 'Aula experimental e freepass que viraram matrícula, contra a conversão da academia. 0 é ficar acima dela.', un: 'pontos' },
    aderencia: { nome: 'Aderência às aulas', texto: 'Semanas em que o aluno veio o bastante, de segunda a sexta.', un: '%', faixa: true },
    cConversao: { nome: 'Conversão em matrícula', texto: 'Leads do consultor cadastrados no período que se matricularam, contra a conversão da academia. 0 é ficar acima dela.', un: 'pontos' },
    vendas: { nome: 'Vendas', texto: 'Matrículas e renovações que o consultor fechou, na média por mês.', un: 'mil por mês', pre: 'R$' },
    cRenovacao: { nome: 'Renovação da carteira', texto: 'Dos clientes do consultor cujo contrato venceu, quantos renovaram.', un: '%' },
    meta: { nome: 'Meta diária batida', texto: 'Dos dias de meta do período, em quantos o consultor bateu a Meta diária.', un: '% dos dias' },
  },
  trilhas: [
    {
      id: 'professor', nome: 'Professor', base: 'professor', vinculo: 'Formado', mods: ['Funcional', 'Pilates', 'Musculação'],
      freq: 'anual', mes: 'Dezembro', periodo: 'Os números contam de 1º de dezembro a 30 de novembro.', pessoas: 7,
      niveis: [{ n: 'Júnior', m: 12, p: 5 }, { n: 'Pleno', m: 24, p: 2 }, { n: 'Sênior', m: null, p: 0 }],
      ligados: ['renovacao', 'nps', 'conversao', 'aderencia'],
      metas: { renovacao: [45, 55, 65], nps: [9, 9, 9], conversao: [0, 0, 0], aderencia: [[60, 70], [60, 70], [60, 70]] },
      ajustes: { conversao: ['Aulas dos últimos', '30', 'dias ainda não contam'], aderencia: ['A semana conta com', '2', 'aulas ou mais'] },
    },
    {
      id: 'estagiario', nome: 'Estagiário', base: 'professor', vinculo: 'Estágio', mods: ['Funcional'],
      freq: 'semestral', mes: 'Junho', periodo: 'Avaliação em junho e dezembro. Os números contam de 1º de dezembro a 31 de maio e de 1º de junho a 30 de novembro.', janela: '12m', pessoas: 3,
      niveis: [{ n: 'Estagiário I', m: 6, p: 2 }, { n: 'Estagiário II', m: 6, p: 1 }, { n: 'Estagiário III', m: null, p: 0 }],
      ligados: ['renovacao', 'nps', 'conversao', 'aderencia'],
      metas: { renovacao: [45, 45, 45], nps: [9, 9, 9], conversao: [0, 0, 0], aderencia: [[60, 70], [60, 70], [60, 70]] },
      ajustes: { conversao: ['Aulas dos últimos', '30', 'dias ainda não contam'], aderencia: ['A semana conta com', '2', 'aulas ou mais'] },
    },
    {
      id: 'consultor', nome: 'Consultor', base: 'consultor', vinculo: 'Qualquer', mods: [],
      freq: 'anual', mes: 'Dezembro', periodo: 'Os números contam de 1º de dezembro a 30 de novembro.', pessoas: 4,
      niveis: [{ n: 'Júnior', m: 12, p: 3 }, { n: 'Pleno', m: 24, p: 1 }, { n: 'Sênior', m: null, p: 0 }],
      ligados: ['cConversao', 'vendas', 'cRenovacao', 'meta'],
      metas: { cConversao: [null, null, null], vendas: [null, null, null], cRenovacao: [null, null, null], meta: [null, null, null] },
      ajustes: {},
    },
  ],
  arquivadas: [{ nome: 'Professor de pilates (teste)', pessoas: 0 }],
};
