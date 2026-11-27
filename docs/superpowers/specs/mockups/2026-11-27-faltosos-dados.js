// Dados de exemplo e helpers dos três mockups da aba Faltosos de Clientes
// (27/11/2026). Nada daqui vai para o app. Alunos inventados; os professores
// são os da STRONIX, para a leitura ficar perto do real.
(function () {
  const HOJE = '2026-11-27';
  const PROFS = {
    heloisa: 'Heloísa', gilson: 'Gilson', leonardo: 'Leonardo', matheus: 'Matheus',
    pedro: 'Pedro Carlos', erick: 'Erick', fiama: 'Fiama',
  };
  // O professor logado na visão "professor" de cada mockup.
  const EU = 'heloisa';
  const MARCOS = [7, 14, 30, 60];
  const ULTIMA = { quando: '23/11 às 09:14', quem: 'Johnny', faltantes: '23/11', presencas: '16/11 a 22/11' };

  // nome, telefone, professor, última presença, plano, fim do contrato, urgente,
  // tarefa: [estado, marco] (estado: pendente | feita | null)
  const RAW = [
    ['Marina Albuquerque', '(51) 99812-4430', 'heloisa', '2026-10-14', 'Clube+ Move', '2026-12-10', true, ['pendente', 30]],
    ['Otávio Rezende', '(51) 98134-9921', 'pedro', '2026-11-02', 'Clube+ Start', '2026-12-18', true, ['pendente', 14]],
    ['Letícia Fagundes', '(51) 99655-0182', 'leonardo', '2026-11-10', 'Clube+ Flow', '2026-12-05', true, ['feita', 14]],
    ['Caio Brandão', '(51) 99207-7745', 'erick', '2026-09-20', 'Clube+ Start', '2027-03-12', false, ['pendente', 60]],
    ['Paula Esteves', '(51) 98842-3306', 'fiama', '2026-09-28', 'No Limit Musculação', '2027-04-02', false, ['feita', 60]],
    ['Rodrigo Saldanha', '(51) 99371-5568', 'heloisa', '2026-10-21', 'Clube+ Move', '2027-02-14', false, ['pendente', 30]],
    ['Tatiane Kunz', '(51) 98720-1409', 'matheus', '2026-10-25', 'Clube+ Flow', '2027-05-20', false, ['feita', 30]],
    ['Gabriel Moura', '(51) 99118-6620', 'pedro', '2026-10-27', 'Clube+ Start', '2027-01-30', false, ['pendente', 30]],
    ['Bruna Holanda', '(51) 99483-2271', 'heloisa', '2026-11-06', 'No Limit Funcional', '2027-06-11', false, ['pendente', 14]],
    ['Vitor Pacheco', '(51) 98569-7034', 'gilson', '2026-11-07', 'Clube+ Move', '2027-02-02', false, ['feita', 14]],
    ['Elisa Carvalho', '(51) 99026-8813', 'erick', '2026-11-11', 'Clube+ Start', '2027-04-19', false, ['pendente', 14]],
    ['Sabrina Kopp', '(51) 99244-8107', 'heloisa', '2026-11-12', 'Clube+ Move', '2027-05-03', false, ['feita', 14]],
    ['Murilo Teles', '(51) 98351-4097', 'heloisa', '2026-11-16', 'Clube+ Move', '2027-01-08', false, ['pendente', 7]],
    ['Daniela Reis', '(51) 99740-3352', 'fiama', '2026-11-17', 'Clube+ Start', '2027-07-01', false, ['feita', 7]],
    ['Igor Venâncio', '(51) 98213-6648', 'leonardo', '2026-11-18', 'Clube+ Flow', '2027-03-28', false, ['pendente', 7]],
    ['Jéssica Lemos', '(51) 99562-1180', null, '2026-10-30', 'Clube+ Start', '2027-02-21', false, [null, 0]],
    ['Fábio Quintana', '(51) 98907-2245', null, '2026-11-12', 'Flex Musculação', '2026-12-28', true, [null, 0]],
  ];
  const NAO_ACHADOS = [
    ['JOAO PEDRO S. LIMA', '(51) 99634-5519', 'Faltantes'],
    ['MARIA EDUARDA KRAUSE', null, 'Presenças'],
  ];

  const D = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const dias = (s) => Math.round((D(HOJE) - D(s)) / 864e5);
  const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  const faixa = (n) => [...MARCOS].reverse().find((m) => n >= m) || MARCOS[0];

  const alunos = RAW.map(([nome, tel, prof, ultima, plano, fim, urgente, [tStatus, tMarco]], i) => {
    const n = dias(ultima);
    return {
      id: `l${i}`, nome, tel, prof, profNome: prof ? PROFS[prof] : 'Sem professor', ultima: ddmm(ultima), dias: n,
      faixa: faixa(n), plano, fim: ddmm(fim), urgente,
      tarefa: tStatus ? { status: tStatus, marco: tMarco } : null,
    };
  }).sort((a, b) => b.dias - a.dias);

  const iniciais = (nome) => nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const avatar = (a, s = 34) => `<span class="av" style="--s:${s}px">${iniciais(a.nome)}</span>`;
  const chip = (t) => {
    if (!t) return '<span class="tk tk-sem">Sem tarefa</span>';
    if (t.status === 'feita') return '<span class="tk tk-ok">Contato feito</span>';
    return `<span class="tk tk-pend">Contato dos ${t.marco} dias</span>`;
  };
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // Andamento da semana por professor (só as tarefas da importação de 23/11).
  const andamento = Object.keys(PROFS).map((id) => {
    const meus = alunos.filter((a) => a.prof === id);
    const pend = meus.filter((a) => a.tarefa?.status === 'pendente').length;
    const feitas = meus.filter((a) => a.tarefa?.status === 'feita').length;
    return { id, nome: PROFS[id], total: meus.length, pend, feitas, urg: meus.filter((a) => a.urgente).length };
  }).filter((p) => p.total > 0).sort((a, b) => b.pend - a.pend || a.nome.localeCompare(b.nome));

  // Visão: gestor ou professor, pelo #professor no endereço.
  const visao = () => (location.hash === '#professor' ? 'professor' : 'gestor');
  const doProfessor = (lista) => lista.filter((a) => a.prof === EU);

  const SETA = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  const SUBIR = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V3M4.5 6.5 8 3l3.5 3.5M3 13h10"/></svg>';

  // Cabeçalho: título, abas de Clientes, pílula de professor e o botão do gestor.
  const cabecalho = ({ total, prof }) => {
    const gestor = visao() === 'gestor';
    const pilula = prof
      ? `<button class="fp on" type="button">Professor: <b>${PROFS[prof]}</b> ${SETA}</button>`
      : `<button class="fp" type="button">Professor ${SETA}</button>`;
    return `<header class="head"><div><h1 class="d">Clientes</h1>
      <div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="false">Carteira <span class="n num">580</span></button><button class="tab" role="tab" aria-selected="true">Faltosos <span class="n num">${total}</span></button></div></div>
      <div class="ctl">${pilula}${gestor ? `<button class="btn" type="button">${SUBIR}Importar planilhas</button>` : ''}</div></header>`;
  };
  const importacao = () => {
    const gestor = visao() === 'gestor';
    return `<section class="card imp"><span>Última importação em <b>${ULTIMA.quando}</b>, por ${ULTIMA.quem}. Faltantes de ${ULTIMA.faltantes}, Presenças de ${ULTIMA.presencas}.</span>${gestor ? '<span class="lem">Na segunda: Faltantes com 7 dias sem vir e Presenças de 23/11 até hoje.</span>' : ''}</section>`;
  };
  const linha = (a) => `<a class="tr" href="#">
    <div class="who">${avatar(a)}<div style="min-width:0"><b>${a.nome}</b><span class="num">${a.tel}</span></div></div>
    <span class="${a.prof ? '' : 'mut'}">${a.profNome}</span>
    <span class="dias num">${plural(a.dias, 'dia', 'dias')}</span>
    <span class="mut num">${a.ultima}</span>
    <div class="ct"><div>${a.plano}</div><small class="num${a.urgente ? ' u' : ''}">${a.urgente ? 'Termina em ' : 'Até '}${a.fim}</small></div>
    ${chip(a.tarefa)}</a>`;
  const cabecaTabela = '<div class="th"><span>Aluno</span><span>Professor</span><span>Sem vir</span><span>Última presença</span><span>Contrato</span><span>Tarefa</span></div>';
  const naoAchadosHtml = (itens) => itens.map((n) => `<div class="na"><b>${n.nome}</b>${n.tel ? `<span class="mut num">${n.tel}</span>` : ''}<span class="mut">no ${n.rel}</span></div>`).join('');
  const trocaVisao = () => {
    const v = visao();
    return `<nav class="vis" aria-label="Visão do mockup"><a href="#" aria-current="${v === 'gestor'}">Gestor</a><a href="#professor" aria-current="${v === 'professor'}">Professor (Heloísa)</a></nav>`;
  };

  window.FT = {
    HOJE, PROFS, EU, MARCOS, ULTIMA, alunos, andamento, avatar, chip, plural, visao, doProfessor,
    cabecalho, importacao, linha, cabecaTabela, naoAchadosHtml, trocaVisao,
    naoAchados: NAO_ACHADOS.map(([nome, tel, rel]) => ({ nome, tel, rel })),
  };
})();
