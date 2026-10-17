// Dados de exemplo e helpers dos três mockups da tela Todos os leads (16/10/2026).
// Nada daqui vai para o app: é só para o mockup parecer a tela de verdade.
(function () {
  const NOW = new Date(2026, 9, 16, 14, 30);
  const dt = (s) => { const [d, t = '12:00'] = s.split(' '); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi); };
  const mid = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const cal = (a, b) => Math.round((mid(b) - mid(a)) / 864e5);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const dmy = (d) => `${dm(d)}/${d.getFullYear()}`;

  const STAGES = [
    { id: 'novo', name: 'Novo lead', c: '#2B59FF' }, { id: 'contato', name: 'Contato feito', c: '#8B5CF6' },
    { id: 'visita', name: 'Visita agendada', c: '#F59E0B' }, { id: 'aula', name: 'Aula experimental', c: '#06B6D4' },
    { id: 'neg', name: 'Negociação', c: '#FF6A2B' }, { id: 'venda', name: 'Venda', c: '#10B981' }, { id: 'perda', name: 'Perda', c: '#94a3b8' },
  ];
  const STAGE = Object.fromEntries(STAGES.map((s, i) => [s.id, { ...s, i }]));
  // Funil de 212 leads, só para os números do topo fazerem sentido.
  const BASE = { novo: 48, contato: 61, visita: 22, aula: 17, neg: 14, venda: 31, perda: 19 };
  const TOTAL = Object.values(BASE).reduce((a, b) => a + b, 0);

  // nome, telefone, consultor, fase, próxima ação, cadastro, hot
  const RAW = [
    ['Otávio Lacerda', '(51) 99812-4430', 'Ana', 'novo', null, '2026-10-16', false],
    ['Gabriel Sampaio', '(51) 98134-9921', 'Diego', 'novo', '2026-10-17 09:00', '2026-10-16', false],
    ['Paula Mendonça', '(51) 99655-0182', 'Larissa', 'novo', null, '2026-10-15', false],
    ['Priscila Ramos', '(51) 99207-7745', 'Ana', 'novo', '2026-10-15 16:00', '2026-10-15', false],
    ['Letícia Franco', '(51) 98842-3306', 'Marcos', 'aula', '2026-10-27 18:30', '2026-10-14', true],
    ['Samuel Vasconcelos', '(51) 99371-5568', 'Diego', 'novo', null, '2026-10-13', false],
    ['Júlia Maciel', '(51) 98720-1409', 'Ana', 'visita', '2026-10-20 18:00', '2026-10-12', false],
    ['Leandro Vidal', '(51) 99118-6620', 'Larissa', 'contato', '2026-10-16 16:00', '2026-10-11', false],
    ['Tatiane Borges', '(51) 99483-2271', 'Marcos', 'visita', '2026-10-16 17:30', '2026-10-10', true],
    ['Débora Salgado', '(51) 98569-7034', 'Diego', 'visita', '2026-10-16 10:30', '2026-10-09', true],
    ['Nicole Azevedo', '(51) 99026-8813', 'Ana', 'contato', '2026-10-30 14:00', '2026-10-09', false],
    ['Bianca Furtado', '(51) 98351-4097', 'Larissa', 'aula', '2026-10-16 19:00', '2026-10-08', true],
    ['Igor Barreto', '(51) 99740-3352', 'Marcos', 'contato', '2026-10-19 10:00', '2026-10-07', false],
    ['Rafaela Teles', '(51) 98213-6648', 'Diego', 'contato', null, '2026-10-06', false],
    ['Rodrigo Maia', '(51) 99562-1180', 'Ana', 'aula', '2026-10-13 19:00', '2026-10-05', false],
    ['Zeca Moreira', '(51) 98907-2245', 'Larissa', 'venda', null, '2026-10-04', false],
    ['Kauê Brandão', '(51) 99634-5519', 'Marcos', 'contato', '2026-10-21 11:00', '2026-10-03', false],
    ['Carlos Eduardo Pinto', '(51) 98476-0963', 'Diego', 'contato', '2026-10-14 18:00', '2026-10-02', false],
    ['Yasmin Torres', '(51) 99289-7706', 'Ana', 'perda', null, '2026-10-01', false],
    ['Mateus Queiroz', '(51) 98690-4417', 'Larissa', 'neg', '2026-11-03 10:00', '2026-10-01', true],
    ['Talita Rezende', '(51) 99851-3028', 'Marcos', 'contato', null, '2026-09-30', false],
    ['Helena Cordeiro', '(51) 98134-5590', 'Diego', 'neg', '2026-10-17 15:00', '2026-09-29', true],
    ['Valéria Duarte', '(51) 99076-6284', 'Ana', 'venda', null, '2026-09-25', false],
    ['Everton Nunes', '(51) 98543-1175', 'Larissa', 'neg', '2026-10-12 09:00', '2026-09-21', true],
    ['Ulisses Cabral', '(51) 99312-8841', 'Marcos', 'venda', null, '2026-09-18', false],
    ['Wagner Lins', '(51) 98765-0432', 'Diego', 'perda', null, '2026-09-12', false],
  ];

  const leads = RAW.map(([name, phone, co, stage, next, created, hot], id) => {
    const n = next ? dt(next) : null;
    const closed = stage === 'venda' || stage === 'perda';
    const late = !!(n && !closed && n < NOW);
    const band = closed ? 'closed' : !n ? 'none' : late ? 'late' : cal(NOW, n) === 0 ? 'today' : cal(NOW, n) <= 6 ? 'week' : 'later';
    return { id, name, phone, co, stage, next: n, created: dt(created), hot, late, band };
  });

  const TINTS = [['#EAF0FF', '#1C3FC4'], ['#FFF1E8', '#C2410C'], ['#E7F8F1', '#047857'], ['#F1ECFE', '#6D28D9'], ['#FFF4D6', '#92400E'], ['#FDE8EE', '#BE123C']];
  const initials = (n) => { const p = n.trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  const avatar = (l, s = 34) => { const [bg, fg] = TINTS[(l.name.charCodeAt(0) + l.name.length) % TINTS.length]; return `<span class="ava" style="--s:${s}px;background:${bg};color:${fg}">${initials(l.name)}</span>`; };
  const chip = (stage) => `<span class="ph" style="--pc:${STAGE[stage].c}"><i></i>${STAGE[stage].name}</span>`;
  const person = (l, s = 34) => `<div class="who">${avatar(l, s)}<div style="min-width:0"><b>${l.name}${l.hot ? '<span class="flame" title="Lead com atividade recente ou agendamento próximo" aria-label="Lead quente">🔥</span>' : ''}</b><div class="sub2"><span class="num">${l.phone}</span><span class="co">@${l.co}</span></div></div></div>`;

  // Próxima ação: o texto de cima diz quando, e o de baixo a data.
  const nextInfo = (l) => {
    if (!l.next) return { t: 'Sem agendamento', s: '', tone: 'none' };
    const d = cal(NOW, l.next); const time = hm(l.next);
    if (l.late) return d === 0 ? { t: 'Atrasado', s: `era hoje às ${time}`, tone: 'late' } : { t: `Atrasado há ${-d} ${-d === 1 ? 'dia' : 'dias'}`, s: `${dm(l.next)} às ${time}`, tone: 'late' };
    if (d === 0) return { t: `Hoje às ${time}`, s: '', tone: 'today' };
    if (d === 1) return { t: `Amanhã às ${time}`, s: dm(l.next), tone: 'soon' };
    return { t: `Em ${d} dias`, s: `${dm(l.next)} às ${time}`, tone: d <= 7 ? 'soon' : 'later' };
  };
  const nextCell = (l) => { const n = nextInfo(l); return `<div class="nx ${n.tone}"><b>${n.t}</b>${n.s ? `<span class="num">${n.s}</span>` : ''}</div>`; };
  const created = (l) => { const d = cal(l.created, NOW); return `<div class="cr num"><b>${dmy(l.created)}</b><span>${d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`}</span></div>`; };

  const ICON = {
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    dot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  };
  const pill = (icon, label, value) => `<button class="fp" type="button">${ICON[icon]}<em>${label}</em><b>${value}</b>${ICON.chev}</button>`;
  // Cabeçalho no cartão dos painéis: título e apoio à esquerda, pílulas à direita.
  // Sem Exportar: a planilha dos leads é do relatório (decisão do Johnny, 16/10/2026).
  const head = (sub, pills) => `<header class="head"><div><h1 class="d">Todos os leads</h1><p class="sub">${sub}</p></div><div class="ctl">${pills}</div></header>`;
  const pF = pill('layers', 'Funil', 'Padrão'), pC = pill('users', 'Consultor', 'Equipe toda'), pFase = pill('dot', 'Fase', 'Todas'), pS = pill('alert', 'Situação', 'Todos');

  window.LD = { NOW, STAGES, STAGE, BASE, TOTAL, leads, avatar, chip, person, nextInfo, nextCell, created, head, pF, pC, pFase, pS, cal };
})();
