// Dados de exemplo e helpers dos três mockups da tela Clientes (16/10/2026).
// Nada daqui vai para o app: é só para o mockup parecer a tela de verdade.
(function () {
  const DAY = 864e5;
  const TODAY = new Date(2026, 9, 16, 12);
  const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const diff = (a, b) => Math.round((a - b) / DAY);

  const STATUS = { ativo: 'Ativo', a_vencer: 'A vencer', trancado: 'Trancado', agendado: 'Agendado', vencido: 'Vencido', cancelado: 'Cancelado', sem: 'Sem contrato' };
  const ORDER = ['ativo', 'a_vencer', 'agendado', 'trancado', 'vencido', 'cancelado', 'sem'];
  // Carteira de 580 clientes, só para os números do topo fazerem sentido.
  const BASE = { ativo: 412, a_vencer: 63, agendado: 8, trancado: 19, vencido: 54, cancelado: 17, sem: 7 };
  const TOTAL = Object.values(BASE).reduce((a, b) => a + b, 0);

  // nome, telefone, consultor, plano, valor do contrato, início, fim, marca
  const RAW = [
    ['Camila Rocha', '(51) 99812-4430', 'Ana', 'Semestral Musculação', 1314, '2026-04-20', '2026-10-20'],
    ['Bruno Teixeira', '(51) 98134-9921', 'Diego', 'Anual Musculação', 2388, '2025-10-18', '2026-10-18'],
    ['Fernanda Lopes', '(51) 99655-0182', 'Larissa', 'Mensal', 229, '2026-09-17', '2026-10-17'],
    ['Rafael Duarte', '(51) 99207-7745', 'Ana', 'Trimestral Musculação', 687, '2026-07-22', '2026-10-22'],
    ['Juliana Prado', '(51) 98842-3306', 'Marcos', 'Musculação + Pilates', 3120, '2025-11-03', '2026-11-03'],
    ['Thiago Menezes', '(51) 99371-5568', 'Diego', 'Anual Musculação', 2388, '2026-02-10', '2027-02-10'],
    ['Larissa Vieira', '(51) 98720-1409', 'Ana', 'Semestral Musculação', 1314, '2026-08-01', '2027-02-01'],
    ['Gustavo Almeida', '(51) 99118-6620', 'Larissa', 'Funcional 3x trimestral', 780, '2026-09-05', '2026-12-05'],
    ['Patrícia Nunes', '(51) 99483-2271', 'Marcos', 'Anual Musculação', 2388, '2026-01-12', '2027-01-12'],
    ['Diego Fontana', '(51) 98569-7034', 'Diego', 'Mensal', 229, '2026-10-01', '2026-11-01'],
    ['Aline Becker', '(51) 99026-8813', 'Ana', 'Pilates 2x semestral', 1620, '2026-06-08', '2026-12-08'],
    ['Marcelo Siqueira', '(51) 98351-4097', 'Larissa', 'Trimestral Musculação', 687, '2026-06-30', '2026-09-30'],
    ['Renata Moraes', '(51) 99740-3352', 'Marcos', 'Anual Musculação', 2388, '2025-10-10', '2026-10-10'],
    ['Vinícius Cardoso', '(51) 98213-6648', 'Diego', 'Mensal', 229, '2026-08-25', '2026-09-25'],
    ['Isadora Pinto', '(51) 99562-1180', 'Ana', 'Semestral Musculação', 1314, '2026-03-01', '2026-09-01'],
    ['Henrique Barros', '(51) 98907-2245', 'Marcos', 'Anual Musculação', 2388, '2026-03-15', '2027-03-15', 'trancado'],
    ['Sofia Andrade', '(51) 99634-5519', 'Larissa', 'Musculação + Pilates', 3120, '2026-05-04', '2027-05-04', 'trancado'],
    ['Lucas Ferraz', '(51) 98476-0963', 'Diego', 'Trimestral Musculação', 687, '2026-07-10', '2026-10-10', 'cancelado'],
    ['Bianca Tavares', '(51) 99289-7706', 'Ana', 'Mensal', 229, '2026-09-02', '2026-10-02', 'cancelado'],
    ['Eduardo Martins', '(51) 98690-4417', 'Marcos', 'Anual Musculação', 2388, '2026-11-01', '2027-11-01', 'agendado'],
    ['Carolina Dias', '(51) 99851-3028', 'Larissa', 'Semestral Musculação', 1314, '2026-10-25', '2027-04-25', 'agendado'],
    ['Felipe Rangel', '(51) 98134-5590', 'Diego', null, null, null, null],
    ['Natália Gomes', '(51) 99076-6284', 'Ana', 'Anual Musculação', 2388, '2026-05-18', '2027-05-18'],
    ['André Castro', '(51) 98543-1175', 'Marcos', 'Trimestral Musculação', 687, '2026-09-14', '2026-12-14'],
    ['Mariana Lopes', '(51) 99312-8841', 'Larissa', 'Funcional 3x semestral', 1560, '2026-04-27', '2026-10-27'],
    ['Pedro Henrique Sá', '(51) 98765-0432', 'Diego', 'Anual Musculação', 2388, '2025-12-02', '2026-12-02'],
  ];

  const clients = RAW.map((r, i) => {
    const [name, phone, co, plan, value, s, e, flag] = r;
    const start = s ? D(s) : null;
    const end = e ? D(e) : null;
    const days = end ? diff(end, TODAY) : null;
    let st;
    if (flag) st = flag;
    else if (!end) st = 'sem';
    else if (days < 0) st = 'vencido';
    else if (days <= 30) st = 'a_vencer';
    else st = 'ativo';
    let pct = null;
    if (start && end) pct = Math.max(0, Math.min(1, diff(TODAY, start) / diff(end, start)));
    if (st === 'agendado') pct = 0;
    if (st === 'trancado') pct = 0.45;
    return { id: i, name, phone, co, plan, value, start, end, days, st, pct };
  }).sort((a, b) => (a.end ? a.end.getTime() : Infinity) - (b.end ? b.end.getTime() : Infinity));

  const TINTS = [['#EAF0FF', '#1C3FC4'], ['#FFF1E8', '#C2410C'], ['#E7F8F1', '#047857'], ['#F1ECFE', '#6D28D9'], ['#FFF4D6', '#92400E'], ['#FDE8EE', '#BE123C']];
  const initials = (n) => { const p = n.trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  const avatar = (c, size) => {
    const [bg, fg] = TINTS[(c.name.charCodeAt(0) + c.name.length) % TINTS.length];
    return `<span class="ring s-${c.st}" style="--s:${size}px"><span class="av" style="background:${bg};color:${fg}">${initials(c.name)}</span></span>`;
  };
  const pill = (st) => `<span class="st s-${st}">${STATUS[st]}</span>`;
  const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dmy = (d) => d.toLocaleDateString('pt-BR');
  const plural = (n) => (n === 1 ? 'dia' : 'dias');
  const when = (c) => {
    switch (c.st) {
      case 'ativo': case 'a_vencer':
        return c.days === 0 ? 'vence hoje' : c.days === 1 ? 'vence amanhã' : `vence em ${c.days} dias`;
      case 'vencido': return c.days === -1 ? 'venceu ontem' : `venceu há ${-c.days} dias`;
      case 'agendado': { const n = diff(c.start, TODAY); return n === 1 ? 'começa amanhã' : `começa em ${n} dias`; }
      case 'trancado': return 'contrato trancado';
      case 'cancelado': return 'contrato cancelado';
      default: return 'sem contrato';
    }
  };

  window.CL = { TODAY, STATUS, ORDER, BASE, TOTAL, clients, avatar, pill, brl, dmy, when, plural, diff };
})();
