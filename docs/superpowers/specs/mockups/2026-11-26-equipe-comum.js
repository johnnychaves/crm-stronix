// Dados e peças comuns aos três mockups do cadastro da equipe (2026-11-26-equipe-*.html).
// Pessoas, CPF, endereços e números são inventados. "Hoje" é 26/11/2026.
const HOJE = new Date(2026, 10, 26);

const I = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  off: '<circle cx="9" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0 1 9-5.2M16 16l5 5M21 16l-5 5"/>',
  back2: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  warn: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v4M12 17h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const ic = (k, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${I[k]}</svg>`;

const PESSOAS = [
  { id: 'johnny', nome: 'Johnny Bittencourt', cor: '#FF6A2B', funcao: 'gestor', vinculo: 'Sócio', admissao: '2019-02-04',
    acesso: 'ok', login: 'johnny@stronix.com.br', cpf: '', rg: '', nasc: '1990-05-21', cel: '(51) 99812-4410', email: '',
    end: null, foto: false, mov: [['adm', '2019-02-04', 'Admissão', 'Sócio']] },
  { id: 'camila', nome: 'Camila Torres', cor: '#2B59FF', funcao: 'consultor', vinculo: 'CLT', admissao: '2025-08-11',
    acesso: 'ok', login: 'camila@stronix.com.br', turno: '14:00 às 22:30', meta: 40, leads: 212,
    cpf: '389.214.507-61', rg: '1094482317', nasc: '1998-09-14', cel: '(51) 99654-1209', email: 'camilatorres@gmail.com',
    end: 'Rua Dom Pedro II, 1180, ap. 302, Higienópolis, Porto Alegre/RS, 90550-142', foto: true,
    mov: [['adm', '2025-08-11', 'Admissão', 'CLT']] },
  { id: 'rafael', nome: 'Rafael Dias', cor: '#0EA5E9', funcao: 'consultor', vinculo: 'CLT', admissao: '2024-03-04',
    acesso: 'ok', login: 'rafael@stronix.com.br', turno: '06:00 às 14:00', meta: 40, leads: 187,
    cpf: '051.772.390-04', rg: '', nasc: '1995-01-30', cel: '(51) 98120-7733', email: '',
    end: null, foto: false, mov: [['adm', '2024-03-04', 'Admissão', 'CLT']] },
  { id: 'bruna', nome: 'Bruna Lopes', cor: '#14B8A6', funcao: 'consultor', vinculo: 'PJ', admissao: '2026-11-24',
    acesso: 'convite', login: 'brunalopes@gmail.com', conviteAte: '01/12', leads: 0,
    cpf: '', rg: '', nasc: '', cel: '(51) 99431-0098', email: 'brunalopes@gmail.com', end: null, foto: false,
    mov: [['adm', '2026-11-24', 'Admissão', 'PJ']] },
  { id: 'diego', nome: 'Diego Viana', cor: '#7C3AED', funcao: 'professor', vinculo: 'CLT', admissao: '2023-06-01',
    acesso: 'ok', login: 'diegoviana@gmail.com', mods: ['Musculação'], nivel: 'Pleno desde 03/2026', cref: '012345-G/RS', alunos: 96,
    cpf: '702.118.940-33', rg: '7081123344', nasc: '1993-11-02', cel: '(51) 99777-2381', email: 'diegoviana@gmail.com',
    end: 'Av. Protásio Alves, 3400, Petrópolis, Porto Alegre/RS, 91310-002', foto: true,
    mov: [['adm', '2023-06-01', 'Admissão', 'CLT']] },
  { id: 'marina', nome: 'Marina Prado', cor: '#DB2777', funcao: 'professor', vinculo: 'CLT', admissao: '2024-03-12',
    acesso: 'sem', mods: ['Funcional'], nivel: 'Pleno desde 03/2026', cref: '021904-G/RS', alunos: 37,
    cpf: '914.302.118-70', rg: '5093318820', nasc: '1996-07-19', cel: '(51) 99510-6624', email: 'marina.prado@gmail.com',
    end: 'Rua Vicente da Fontoura, 2201, ap. 504, Rio Branco, Porto Alegre/RS, 90640-003', foto: true,
    mov: [['adm', '2022-02-07', 'Admissão', 'Estágio'], ['des', '2023-12-15', 'Desligamento', 'Fim de contrato', 'Formatura, fim do termo de estágio.'], ['rea', '2024-03-12', 'Readmissão', 'CLT']] },
  { id: 'tiago', nome: 'Tiago Araújo', cor: '#9333EA', funcao: 'professor', vinculo: 'CLT', admissao: '2025-02-03',
    acesso: 'sem', mods: ['Funcional'], nivel: 'Júnior desde 02/2025', cref: '034561-G/RS', alunos: 33,
    cpf: '450.661.302-18', rg: '', nasc: '1999-03-08', cel: '(51) 98007-1145', email: '', end: null, foto: false,
    mov: [['adm', '2025-02-03', 'Admissão', 'CLT']] },
  { id: 'livia', nome: 'Lívia Reis', cor: '#0D9488', funcao: 'professor', vinculo: 'CLT', admissao: '2024-09-16',
    acesso: 'sem', mods: ['Pilates'], nivel: 'Júnior desde 09/2024', cref: '029876-G/RS', alunos: 41,
    cpf: '630.115.874-90', rg: '3091187725', nasc: '1997-12-01', cel: '(51) 99320-4418', email: 'livia.reis@outlook.com',
    end: null, foto: true, mov: [['adm', '2024-09-16', 'Admissão', 'CLT']] },
  { id: 'otavio', nome: 'Otávio Costa', cor: '#0891B2', funcao: 'professor', vinculo: 'Estágio', admissao: '2026-02-02',
    acesso: 'sem', mods: ['Pilates'], nivel: '', cref: '', alunos: 37,
    cpf: '118.904.226-51', rg: '', nasc: '2004-04-27', cel: '(51) 98455-3307', email: '', end: null, foto: false,
    mov: [['adm', '2026-02-02', 'Admissão', 'Estágio']] },
  { id: 'sabrina', nome: 'Sabrina Nunes', cor: '#CA8A04', funcao: 'professor', vinculo: 'Estágio', admissao: '2026-08-03',
    acesso: 'sem', mods: ['Musculação'], nivel: '', cref: '', alunos: 22,
    cpf: '', rg: '', nasc: '', cel: '(51) 99102-8819', email: '', end: null, foto: false,
    mov: [['adm', '2026-08-03', 'Admissão', 'Estágio']] },
  { id: 'fernanda', nome: 'Fernanda Rocha', cor: '#E11D48', funcao: 'professor', vinculo: 'CLT', admissao: '2021-05-10',
    acesso: 'sem', mods: ['Musculação', 'Funcional'], nivel: 'Sênior desde 12/2025', cref: '008812-G/RS', alunos: 120,
    cpf: '207.338.519-02', rg: '9087712205', nasc: '1989-10-23', cel: '(51) 99280-0041', email: 'fe.rocha@gmail.com',
    end: 'Rua Mostardeiro, 780, Moinhos de Vento, Porto Alegre/RS, 90430-000', foto: true,
    mov: [['adm', '2021-05-10', 'Admissão', 'CLT']] },
  { id: 'carla', nome: 'Carla Mendes', cor: '#64748B', funcao: 'consultor', vinculo: 'CLT', admissao: '2025-01-13',
    acesso: 'off', desligada: '10/10/2026', leads: 0,
    cpf: '602.991.437-28', rg: '4022918876', nasc: '1997-06-05', cel: '(51) 99611-3390', email: 'carlamendes@gmail.com',
    end: 'Rua Cel. Bordini, 455, Auxiliadora, Porto Alegre/RS, 90440-001', foto: false,
    mov: [['adm', '2025-01-13', 'Admissão', 'CLT'], ['des', '2026-10-10', 'Desligamento', 'Pedido de demissão', 'Mudou de cidade.']] },
];

const byId = (id) => PESSOAS.find((p) => p.id === id);
const ativos = () => PESSOAS.filter((p) => p.acesso !== 'off');
const desligados = () => PESSOAS.filter((p) => p.acesso === 'off');

const FUNCAO = { gestor: 'Gestor', consultor: 'Consultor', professor: 'Professor' };
const VINCULOS = ['CLT', 'Estágio', 'PJ', 'Sócio', 'Temporário', 'Outro'];
const TIPOS_DESLIG = ['Pedido de demissão', 'Sem justa causa', 'Justa causa', 'Acordo', 'Fim de contrato', 'Outro'];

const iniciais = (n) => n.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((w) => w[0]).join('').toUpperCase();
const primeiro = (n) => n.split(' ')[0];
const dataBR = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
function tempo(iso) {
  if (!iso) return '';
  const a = new Date(iso + 'T12:00');
  let meses = (HOJE.getFullYear() - a.getFullYear()) * 12 + (HOJE.getMonth() - a.getMonth());
  if (HOJE.getDate() < a.getDate()) meses -= 1;
  if (meses < 1) { const dias = Math.round((HOJE - a) / 864e5); return dias <= 0 ? 'desde hoje' : `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`; }
  const anos = Math.floor(meses / 12), m = meses % 12;
  const pa = anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '';
  const pm = m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  return 'há ' + [pa, pm].filter(Boolean).join(' e ');
}
function idade(iso) {
  if (!iso) return '';
  const n = new Date(iso + 'T12:00');
  let a = HOJE.getFullYear() - n.getFullYear();
  if (HOJE < new Date(HOJE.getFullYear(), n.getMonth(), n.getDate())) a -= 1;
  return `${a} anos`;
}

// O que conta no anel da ficha. CREF só para professor formado.
function faltas(p) {
  const f = [];
  if (!p.foto) f.push('Foto');
  if (!p.cpf) f.push('CPF');
  if (!p.rg) f.push('RG');
  if (!p.nasc) f.push('Nascimento');
  if (!p.cel) f.push('Celular');
  if (!p.email) f.push('E-mail pessoal');
  if (!p.end) f.push('Endereço');
  if (p.funcao === 'professor' && p.vinculo !== 'Estágio' && !p.cref) f.push('CREF');
  return f;
}
const totalItens = (p) => (p.funcao === 'professor' && p.vinculo !== 'Estágio' ? 10 : 9);
function ring(p) {
  const tot = totalItens(p), ok = tot - faltas(p).length;
  return `<span class="ring ${ok === tot ? 'full' : ''}" style="--p:${Math.round((ok / tot) * 100)}" data-n="${ok}/${tot}" title="Ficha: ${ok} de ${tot}" aria-label="Ficha com ${ok} de ${tot} itens"></span>`;
}

const avatar = (p, s = 36) => `<span class="av" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.36)}px;background:${p.foto ? `linear-gradient(150deg,${p.cor},#0E1A40)` : p.cor}">${iniciais(p.nome)}</span>`;
const roleBadge = (p) => `<span class="role ${p.funcao}">${FUNCAO[p.funcao]}</span>`;
const vinBadge = (p) => `<span class="vin ${p.vinculo === 'Estágio' ? 'estagio' : ''}">${p.vinculo === 'Estágio' ? 'Estagiário' : p.vinculo}</span>`;
function accBadge(p) {
  if (p.acesso === 'ok') return '<span class="acc ok"><i></i>Com acesso</span>';
  if (p.acesso === 'convite') return `<span class="acc wait"><i></i>Convite até ${p.conviteAte}</span>`;
  if (p.acesso === 'off') return `<span class="acc off"><i></i>Desligada em ${p.desligada}</span>`;
  return '<span class="acc none"><i></i>Sem acesso</span>';
}
const kv = (rotulo, valor, vazio) => `<div><dt>${rotulo}</dt>${valor ? `<dd>${valor}</dd>` : `<dd class="empty"><button type="button">${vazio || 'Adicionar'}</button></dd>`}</div>`;

// ---- Seções da ficha (leitura) -------------------------------------------
function secIdentidade(p, { editando = false } = {}) {
  const falta = ['CPF', 'RG', 'Nascimento', 'Foto'].filter((x) => faltas(p).includes(x));
  if (editando) {
    return `<section class="sec" aria-label="Identidade, editando">
      <h3><span class="grow">Identidade</span><span class="mut" style="font:500 12px Geist">Só o gestor vê</span></h3>
      <div style="display:grid;gap:12px;margin-top:14px">
        <div class="f"><label class="lb" for="e-nome">Nome completo</label><input id="e-nome" class="in" value="${p.nome}"></div>
        <div class="grid2">
          <div class="f"><label class="lb" for="e-cpf">CPF</label><input id="e-cpf" class="in on num" value="${p.cpf || ''}" placeholder="000.000.000-00"></div>
          <div class="f"><label class="lb" for="e-rg">RG <small>opcional</small></label><input id="e-rg" class="in num" placeholder="Só números" value="${p.rg}"></div>
        </div>
        <div class="grid2">
          <div class="f"><label class="lb" for="e-nasc">Nascimento</label><input id="e-nasc" class="in num" value="${dataBR(p.nasc)}" placeholder="dd/mm/aaaa"></div>
          <div class="f"><span class="lb">Foto</span><button class="btn" type="button" style="height:42px">${ic('cam')}Tirar ou escolher foto</button></div>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px"><button class="btn gh" type="button">Cancelar</button><button class="btn pri" type="button">Salvar identidade</button></div>
    </section>`;
  }
  return `<section class="sec"><h3><span class="grow">Identidade</span>${falta.length ? `<span class="pend">Falta ${falta.join(', ').toLowerCase()}</span>` : '<span class="okt">Completa</span>'}<button class="btn sm" type="button">Editar</button></h3>
    <dl class="kv">${kv('Nome completo', p.nome)}${kv('CPF', p.cpf && `<span class="num">${p.cpf}</span>`)}${kv('RG', p.rg && `<span class="num">${p.rg}</span>`)}${kv('Nascimento', p.nasc && `${dataBR(p.nasc)} <span class="mut">(${idade(p.nasc)})</span>`)}</dl></section>`;
}
function secContato(p) {
  const falta = ['Celular', 'E-mail pessoal', 'Endereço'].filter((x) => faltas(p).includes(x));
  return `<section class="sec"><h3><span class="grow">Contato</span>${falta.length ? `<span class="pend">Falta ${falta.join(', ').toLowerCase()}</span>` : '<span class="okt">Completo</span>'}<button class="btn sm" type="button">Editar</button></h3>
    <dl class="kv">${kv('Celular', p.cel && `<span class="num">${p.cel}</span>`)}${kv('E-mail pessoal', p.email)}<div class="wide"><dt>Endereço</dt>${p.end ? `<dd>${p.end}</dd>` : '<dd class="empty"><button type="button">Adicionar endereço</button></dd>'}</div></dl></section>`;
}
function secTrabalho(p) {
  const prof = p.funcao === 'professor';
  const estag = p.vinculo === 'Estágio';
  let extra = '';
  if (prof) {
    extra = kv('Modalidades', p.mods.join(' e '))
      + (estag ? '' : kv('CREF', p.cref && `<span class="num">${p.cref}</span>`))
      + `<div><dt>Nível no Stronix 2.0</dt><dd>${p.nivel || '<span class="mut">Sem nível</span>'} <a class="lnk" href="#" style="font-size:12.5px;margin-left:4px">Ver perfil</a></dd></div>`
      + kv('Alunos na carteira', `<span class="num">${p.alunos}</span>`);
  }
  if (p.funcao === 'consultor' && p.leads != null) extra = kv('Leads na carteira', `<span class="num">${p.leads}</span>`);
  return `<section class="sec"><h3><span class="grow">Trabalho</span><button class="btn sm" type="button">Editar</button></h3>
    <dl class="kv">${kv('Função', FUNCAO[p.funcao])}${kv('Vínculo', estag ? 'Estágio' : p.vinculo)}${kv('Admissão', `${dataBR(p.admissao)} <span class="mut">(${tempo(p.admissao)})</span>`)}${extra}</dl>
    ${estag && prof ? '<p class="note-mini">Estagiário. Os níveis do estágio chegam com o plano de carreira configurável.</p>' : ''}</section>`;
}
function secAcesso(p) {
  let corpo, acoes;
  if (p.acesso === 'ok') {
    corpo = `<dl class="kv">${kv('Situação', '<span class="acc ok"><i></i>Com acesso</span>')}${kv('Papel', FUNCAO[p.funcao])}${kv('E-mail de login', p.login)}${p.turno ? kv('Turno', p.turno) : ''}${p.meta ? kv('Meta de prospecção', `${p.meta} ações por dia`) : ''}</dl>`;
    acoes = `<button class="btn sm" type="button">${ic('key')}Trocar senha</button>${p.funcao !== 'gestor' ? '<button class="btn sm danger" type="button">Tirar acesso</button>' : ''}`;
  } else if (p.acesso === 'convite') {
    corpo = `<dl class="kv">${kv('Situação', `<span class="acc wait"><i></i>Convite enviado, vale até ${p.conviteAte}</span>`)}${kv('Papel', FUNCAO[p.funcao])}${kv('E-mail do convite', p.login)}</dl>`;
    acoes = `<button class="btn sm" type="button">${ic('link')}Copiar link</button><button class="btn sm" type="button">Gerar outro</button>`;
  } else if (p.acesso === 'off') {
    corpo = '<p class="mut" style="margin-top:10px;font-size:13px">O acesso saiu no desligamento. Readmitir deixa dar acesso de novo.</p>';
    acoes = '';
  } else {
    corpo = '<p class="mut" style="margin-top:10px;font-size:13px">Aparece na agenda das aulas experimentais e no NPS, mas não entra no Stronilead.</p>';
    acoes = `<button class="btn sm" type="button">${ic('key')}Dar acesso</button>`;
  }
  return `<section class="sec"><h3><span class="grow">Acesso ao app</span>${acoes}</h3>${corpo}</section>`;
}
function movimentacoes(p) {
  const itens = [...p.mov].reverse().map(([k, d, tit, sub, motivo]) => `<li class="mv ${k}"><span class="when num">${dataBR(d)}</span><span class="node"></span><div><b>${tit}</b><p>${k === 'des' ? `${sub}${motivo ? `. ${motivo}` : ''}` : `Vínculo ${sub}`}</p></div></li>`).join('');
  return `<section class="sec"><h3><span class="grow">Movimentações</span>${p.acesso === 'off' ? `<button class="btn sm" type="button">${ic('back2')}Readmitir</button>` : `<button class="btn sm danger" type="button" data-desligar="${p.id}">${ic('off')}Desligar</button>`}</h3>
    <ol class="timeline" style="list-style:none;padding:0;margin:14px 0 0">${itens}</ol>
    <p class="note-mini">Ninguém apaga uma movimentação. Tipo e motivo do desligamento só o gestor vê.</p></section>`;
}
function faltaLinha(p) {
  const f = faltas(p);
  if (!f.length) return '<span style="font:600 13px Geist;color:var(--green700)">Ficha completa</span>';
  return `<span style="font-size:13px;color:var(--ink2)">Falta: ${f.map((x) => `<button class="lnk" type="button">${x}</button>`).join(', ')}</span>`;
}

// ---- Cadastrar pessoa, passo a passo --------------------------------------
const CAD = { passo: 0, funcao: 'professor', nome: 'Paula Martins', cel: '(51) 99510-6624', email: 'paula.martins@gmail.com', mods: ['Funcional'], vinculo: 'Estágio', admissao: '26/11/2026', acesso: 'sem' };
const PASSOS = ['funcao', 'quem', 'mods', 'vinculo', 'acesso'];
function passosVisiveis() { return PASSOS.filter((s) => s !== 'mods' || CAD.funcao === 'professor'); }
function resumoPasso(s) {
  if (s === 'funcao') return FUNCAO[CAD.funcao];
  if (s === 'quem') return `${CAD.nome}, ${CAD.cel}`;
  if (s === 'mods') return CAD.mods.join(' e ');
  if (s === 'vinculo') return `${CAD.vinculo === 'Estágio' ? 'Estagiário' : CAD.vinculo}, admissão em ${CAD.admissao}`;
  if (s === 'acesso') return { convite: 'Convite por link', senha: 'Senha temporária', sem: 'Sem acesso por enquanto' }[CAD.acesso];
  return '';
}
const TITULOS = { funcao: 'Função', quem: 'Quem é', mods: 'Modalidades em que dá aula', vinculo: 'Vínculo e admissão', acesso: 'Acesso ao app' };
const opt = (grupo, valor, atual, titulo, desc, dis) => `<button type="button" role="radio" class="opt ${dis ? 'dis' : ''}" aria-checked="${valor === atual}" ${dis ? 'aria-disabled="true"' : `data-cad="${grupo}" data-v="${valor}"`}><span class="dot"></span><span><b>${titulo}</b><span>${desc}</span></span></button>`;
const chip = (grupo, valor, on) => `<button type="button" class="ch" role="${grupo === 'mods' ? 'checkbox' : 'radio'}" aria-checked="${on}" data-cad="${grupo}" data-v="${valor}">${valor}</button>`;
function corpoPasso(s) {
  if (s === 'funcao') return `<div class="opts" role="radiogroup" aria-label="Função">
    ${opt('funcao', 'consultor', CAD.funcao, 'Consultor', 'Atende os leads e tem Meta diária. Ocupa uma vaga do plano.')}
    ${opt('funcao', 'professor', CAD.funcao, 'Professor', 'Dá aula e tem carteira de alunos. Não ocupa vaga do plano.')}
    ${opt('funcao', 'gestor', CAD.funcao, 'Gestor', 'Configura a academia e vê a equipe toda. Entra por convite.')}</div>`;
  if (s === 'quem') return `<div class="f"><label class="lb" for="c-nome">Nome completo</label><input id="c-nome" class="in" value="${CAD.nome}"></div>
    <div class="grid2"><div class="f"><label class="lb" for="c-cel">Celular</label><input id="c-cel" class="in num" value="${CAD.cel}"></div>
    <div class="f"><label class="lb" for="c-mail">E-mail</label><input id="c-mail" class="in" value="${CAD.email}"></div></div>`;
  if (s === 'mods') return `<div class="chips" role="group" aria-label="Modalidades">${['Musculação', 'Funcional', 'Pilates'].map((m) => chip('mods', m, CAD.mods.includes(m))).join('')}</div>`;
  if (s === 'vinculo') return `<div class="f"><span class="lb">Vínculo</span><div class="chips" role="radiogroup" aria-label="Vínculo">${VINCULOS.map((v) => chip('vinculo', v, CAD.vinculo === v)).join('')}</div></div>
    ${CAD.vinculo === 'Estágio' && CAD.funcao === 'professor' ? '<div class="callout warn">' + ic('info') + '<span>Estagiário entra sem CREF. O nível do estágio vem com o plano de carreira configurável.</span></div>' : ''}
    <div class="f" style="max-width:220px"><label class="lb" for="c-adm">Admissão</label><input id="c-adm" class="in num" value="${CAD.admissao}"></div>`;
  if (s === 'acesso') {
    const semOk = CAD.funcao === 'professor';
    const ehGestor = CAD.funcao === 'gestor';
    return `<div class="opts" role="radiogroup" aria-label="Acesso ao app">
      ${opt('acesso', 'convite', CAD.acesso, 'Mandar convite', `A pessoa cria a própria senha pelo link, que vale 7 dias. Vai para ${CAD.email}.`)}
      ${opt('acesso', 'senha', CAD.acesso, 'Criar com senha temporária', 'Você entrega a senha e a pessoa troca depois.', ehGestor)}
      ${opt('acesso', 'sem', CAD.acesso, 'Sem acesso por enquanto', semOk ? 'Aparece na agenda e no NPS. Dá para dar acesso depois, na ficha.' : 'Só professor fica sem acesso: consultor e gestor trabalham no app.', !semOk)}
    </div>
    ${CAD.funcao === 'consultor' ? '<div class="callout warn">' + ic('info') + '<span>Os 4 consultores do plano já estão em uso. Este entra como <b>extra</b>: mais R$ 49 por mês, a partir da próxima fatura.</span></div>' : ''}
    ${ehGestor ? '<div class="callout info">' + ic('info') + '<span>Gestor entra só por convite, para a senha ser dele desde o começo.</span></div>' : ''}`;
  }
  return '';
}
function cadastroPassos() {
  const vis = passosVisiveis();
  if (CAD.passo >= vis.length) return cadastroPronto();
  return vis.map((s, i) => {
    const est = i < CAD.passo ? 'done' : i === CAD.passo ? 'cur' : 'wait';
    return `<div class="step ${est}"><div class="sh"><span class="n">${est === 'done' ? '✓' : i + 1}</span><span class="t">${TITULOS[s]}</span>${est === 'done' ? `<button class="lnk" type="button" data-volta="${i}">Editar</button>` : ''}</div>
      ${est === 'done' ? `<p class="sum">${resumoPasso(s)}</p>` : ''}
      ${est === 'cur' ? `<div class="bd">${corpoPasso(s)}<div><button class="btn pri" type="button" data-continuar>${i === vis.length - 1 ? 'Cadastrar' : 'Continuar'}</button></div></div>` : ''}</div>`;
  }).join('');
}
function cadastroPronto() {
  const quem = primeiro(CAD.nome);
  const mods = CAD.funcao === 'professor' ? ` de ${CAD.mods.join(' e ')}` : '';
  return `<div style="padding:18px 0;display:grid;gap:16px">
    <div style="display:flex;gap:14px;align-items:center">${avatar({ nome: CAD.nome, cor: '#DB2777' }, 52)}<div><h3 class="d" style="font-size:20px">${CAD.nome} entrou na equipe</h3><p class="mut">${FUNCAO[CAD.funcao]}${mods}, ${CAD.vinculo === 'Estágio' ? 'estagiário' : CAD.vinculo}, desde ${CAD.admissao}</p></div></div>
    <dl class="kv" style="margin:0">${kv('Acesso ao app', resumoPasso('acesso'))}${kv('Celular', CAD.cel)}${kv('E-mail', CAD.email)}</dl>
    <div class="callout warn">${ic('info')}<span>Falta na ficha de ${quem}: foto, CPF, RG, nascimento e endereço${CAD.vinculo === 'Estágio' || CAD.funcao !== 'professor' ? '' : ', CREF'}. Dá para completar agora ou depois.</span></div>
  </div>`;
}
function cadastroRodape() {
  if (CAD.passo >= passosVisiveis().length) return '<span class="status ok"><i></i>Salvo</span><button class="btn" type="button" data-de-novo>Cadastrar outra pessoa</button><button class="btn pri" type="button">Completar a ficha</button>';
  const falta = passosVisiveis().length - CAD.passo;
  return `<span class="status"><i></i>${falta === 1 ? 'Falta o acesso ao app' : `Faltam ${falta} passos`}</span><button class="btn gh" type="button">Cancelar</button>`;
}
function ligarCadastro(raiz, redesenhar) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cad) {
      const g = b.dataset.cad, v = b.dataset.v;
      if (g === 'mods') CAD.mods = CAD.mods.includes(v) ? CAD.mods.filter((m) => m !== v) : [...CAD.mods, v];
      else CAD[g] = v;
      if (g === 'funcao') CAD.acesso = v === 'professor' ? 'sem' : 'convite';
      redesenhar();
    } else if (b.hasAttribute('data-continuar')) { CAD.passo += 1; redesenhar(); }
    else if (b.dataset.volta) { CAD.passo = Number(b.dataset.volta); redesenhar(); }
    else if (b.hasAttribute('data-de-novo')) { CAD.passo = 0; redesenhar(); }
  });
}

// ---- Desligar ---------------------------------------------------------------
function desligarDialogo(p, { substituto = '' } = {}) {
  const quem = primeiro(p.nome);
  const prof = p.funcao === 'professor';
  const bloqueado = p.funcao === 'consultor' && p.leads > 0;
  const colegas = PESSOAS.filter((x) => x.id !== p.id && x.funcao === 'professor' && x.acesso !== 'off' && x.mods && x.mods.some((m) => p.mods.includes(m)));
  const falta = bloqueado ? `Passe os leads de ${quem} antes` : prof && !substituto ? 'Escolha quem fica com os alunos' : null;
  return `<div class="scrim"></div><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dl-t">
    <header>${avatar(p, 40)}<div style="flex:1"><h2 id="dl-t">Desligar ${p.nome}</h2><p>${FUNCAO[p.funcao]}, ${p.vinculo === 'Estágio' ? 'estagiário' : p.vinculo}, na equipe ${tempo(p.admissao)}</p></div><button class="x" type="button" aria-label="Fechar">${ic('x')}</button></header>
    <div class="bd">
      ${bloqueado ? `<div class="callout bad">${ic('warn')}<span>${quem} ainda é dono de <b>${p.leads} leads</b>, contando clientes e perdas. Passe a carteira em Migrar leads, marcando Leads em aberto, Clientes ativos e Perdas, e volte aqui. <button class="lnk" type="button" style="color:inherit;text-decoration:underline">Abrir Migrar leads</button></span></div>` : ''}
      <div class="grid2"><div class="f"><label class="lb" for="dl-data">Data do desligamento</label><input id="dl-data" class="in num" value="26/11/2026"></div><div></div></div>
      <div class="f"><span class="lb">Tipo</span><div class="chips" role="radiogroup" aria-label="Tipo de desligamento">${TIPOS_DESLIG.map((t, i) => `<button type="button" class="ch" role="radio" aria-checked="${i === 0}">${t}</button>`).join('')}</div></div>
      <div class="f"><label class="lb" for="dl-mot">Motivo <small>opcional, só o gestor vê</small></label><textarea id="dl-mot" class="in" rows="2" placeholder="Ex.: mudou de cidade"></textarea></div>
      ${prof ? `<div class="callout ${substituto ? 'okc' : 'info'}" style="display:grid;gap:10px">
        <span>${quem} tem <b>${p.alunos} alunos</b> de ${p.mods.join(' e ')} na carteira. Quem fica com eles?</span>
        <select class="in" aria-label="Novo professor dos alunos" style="background:#fff;color:var(--ink)" data-subst>
          <option value="" ${substituto ? '' : 'selected'}>Escolha o professor</option>
          ${colegas.map((c) => `<option ${substituto === c.id ? 'selected' : ''} value="${c.id}">${c.nome}, ${c.mods.join(' e ')}${c.vinculo === 'Estágio' ? ' (estagiário)' : ''}</option>`).join('')}
        </select>
        <span style="font-size:12.5px">A troca entra no histórico de cada aluno, e a renovação de antes de hoje continua contando para ${quem}.</span></div>` : ''}
      <div class="callout warn">${ic('info')}<span>${p.acesso === 'ok' ? `O acesso de ${quem} ao app sai agora e as sessões abertas caem.` : `${quem} não tem acesso ao app.`} ${prof ? `${quem} sai da agenda das aulas experimentais. O perfil e o NPS continuam guardados.` : ''} A ficha vai para Desligados.</span></div>
    </div>
    <footer><span class="status ${falta ? '' : 'ok'}"><i></i>${falta || 'Pronto para desligar'}</span><button class="btn gh" type="button">Cancelar</button><button class="btn danger full" type="button" ${falta ? 'aria-disabled="true"' : ''}>Desligar ${quem}</button></footer>
  </div>`;
}
// Escolher o substituto no select redesenha o diálogo com o botão ligado.
function ligarDesligar(raiz, p, redesenhar) {
  raiz.addEventListener('change', (e) => { if (e.target.matches('[data-subst]')) redesenhar(e.target.value); });
}

// ---- Barra de estados do mockup ---------------------------------------------
function barraDeEstados(estados, render) {
  const nav = document.createElement('nav');
  nav.className = 'states';
  nav.setAttribute('aria-label', 'Estados do mockup');
  const atual = () => (location.hash.slice(1) || estados[0][0]);
  const pinta = () => {
    nav.innerHTML = estados.map(([id, rot]) => `<button type="button" data-e="${id}" aria-pressed="${id === atual()}">${rot}</button>`).join('');
    render(atual());
  };
  nav.addEventListener('click', (e) => { const b = e.target.closest('[data-e]'); if (b) location.hash = b.dataset.e; });
  window.addEventListener('hashchange', pinta);
  document.body.appendChild(nav);
  pinta();
}

const TRILHO = `<nav class="rail" aria-label="Configurações">
  <a href="#">Visão geral</a>
  <div class="g">Academia</div><a href="#">Perfil da academia</a><a href="#">Plano & faturas</a>
  <div class="g">Equipe</div><a href="#" class="on" aria-current="page">Equipe & acessos <em>9</em></a>
  <div class="g">Dia a dia</div><a href="#">Metas & ritmo</a><a href="#">Agendamento</a><a href="#">Rotinas</a>
  <div class="g">Funil</div><a href="#">Funis & etapas</a><a href="#">Catálogos</a>
  <div class="g">Conexões</div><a href="#">Stronizap</a>
  <div class="g">Manutenção da base</div><a href="#">Migrar leads</a><a href="#">Indicações sem dono</a>
</nav>`;
const CASCA = (conteudo, { trilho = true } = {}) => `<div class="app"><aside class="side" aria-hidden="true"><span class="logo"></span><i></i><i></i><i></i><i></i><i></i><i class="on"></i></aside>
  <div class="main"><header class="top"><b>Configurações</b><span>STRONIX</span></header><div class="body" ${trilho ? '' : 'style="grid-template-columns:1fr"'}>${trilho ? TRILHO : ''}<main class="content">${conteudo}</main></div></div></div>`;
const VAGAS = `<div class="seats">${ic('info', 'style="width:16px;height:16px;color:var(--blue)"')}<span><b>Plano Pro: 3 de 4 consultores inclusos.</b> <span class="mut">Professores e gestores não ocupam vaga.</span></span><span class="dash" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span></div>`;
