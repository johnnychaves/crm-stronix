// Peças comuns dos três mockups da Meta diária do professor (27/11/2026).
// Usa os dados de 2026-11-27-faltosos-dados.js (window.FT). Nada vai para o app.
(function () {
  const F = window.FT;
  const SETA = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  const WA = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>';

  // O professor visto na tela: na visão do professor é sempre a Heloísa; o
  // gestor escolhe no seletor (guardado em window.__prof).
  const gestor = () => F.visao() === 'gestor';
  const profVisto = () => (gestor() ? (window.__prof || 'heloisa') : F.EU);
  const meus = () => F.alunos.filter((a) => a.prof === profVisto() && a.tarefa);
  const pendentes = () => meus().filter((a) => a.tarefa.status === 'pendente')
    .sort((a, b) => (b.urgente - a.urgente) || (b.dias - a.dias));
  const feitos = () => meus().filter((a) => a.tarefa.status === 'feita');
  const motivo = (a) => (a.urgente ? `Urgente: o contrato termina em ${a.fim}` : `Marco dos ${a.tarefa.marco} dias sem vir`);
  const ultimoContato = (a) => (a.tarefa.status === 'feita' ? 'WhatsApp em 24/11, por você: vai voltar' : 'Nenhum contato de falta neste período');

  // Faixa do topo, como a da Meta do consultor.
  const faixa = () => {
    const p = pendentes().length; const f = feitos().length; const tot = p + f;
    const nome = F.PROFS[profVisto()];
    const sel = gestor()
      ? `<label class="selp">Ver a Meta de <select data-prof>${Object.entries(F.PROFS).map(([id, n]) => `<option value="${id}"${id === profVisto() ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`
      : '';
    return `<header class="dia">
      <div><h1 class="d">${gestor() ? `Meta diária de ${nome}` : `Bom dia, ${nome}`}</h1>
      <p class="mut">Faltosos da semana, da importação de segunda, 23/11. <span class="vivo"><i></i>Ao vivo</span></p></div>
      <div class="dia-r">${sel}<div class="prog"><b class="d num">${f} de ${tot}</b><span class="mut">contatos feitos</span><span class="pb"><i style="width:${tot ? f / tot * 100 : 0}%"></i></span></div></div></header>
      ${gestor() ? `<p class="obs">Você está vendo a Meta de ${nome}. O que você registrar aqui fica no seu nome.</p>` : ''}`;
  };

  // O balão do Registrar contato, igual nos três.
  const modal = (a) => `<div class="ov" data-close><div class="pop" role="dialog" aria-modal="true" aria-labelledby="pt">
      <div class="pop-h"><h2 class="d" id="pt">Registrar contato</h2><button type="button" class="x" data-close aria-label="Fechar">×</button></div>
      <div class="pop-l">${F.avatar(a, 32)}<div><b>${a.nome}</b><span class="mut">${motivo(a)}. Sem vir desde ${a.ultima} (${a.dias} dias).</span></div></div>
      <div class="pop-b">
        <p class="lb">Como foi o contato</p>
        <div class="chips" role="radiogroup">${['WhatsApp', 'Ligação', 'Pessoalmente'].map((c, i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="ch">${c}</button>`).join('')}</div>
        <p class="lb">O que aconteceu</p>
        <div class="cards" role="radiogroup">${[['Vai voltar', 'Combinou de voltar a treinar.'], ['Respondeu', 'Conversou, mas sem data para voltar.'], ['Não respondeu', 'Mandou mensagem ou ligou e ficou sem resposta.'], ['Quer cancelar', 'O gestor recebe o aviso no sino.']].map(([t, d], i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="oc${t === 'Quer cancelar' ? ' red' : ''}"><b>${t}</b><span>${d}</span></button>`).join('')}</div>
        <button type="button" class="add">+ Adicionar observação</button>
      </div>
      <div class="pop-f"><span class="mut">Fica na linha do tempo como "Contato de falta".</span><button type="button" class="btn" data-close>Registrar contato</button></div>
    </div></div>`;

  const acoes = (a, extra = '') => `<div class="acts">
      <a class="b2 wa" href="#" onclick="return false">${WA}WhatsApp</a>
      <button type="button" class="btn" data-reg="${a.id}">Registrar contato</button>
      <button type="button" class="b2" data-volta="${a.id}">Já voltou</button>${extra}</div>`;

  function ligar(render) {
    document.addEventListener('click', (e) => {
      const r = e.target.closest('[data-reg]');
      if (r) { const a = F.alunos.find((x) => x.id === r.dataset.reg); document.body.insertAdjacentHTML('beforeend', modal(a)); return; }
      if (e.target.matches('[data-close]')) { document.querySelector('.ov')?.remove(); return; }
      const ch = e.target.closest('[role=radio]');
      if (ch) ch.parentElement.querySelectorAll('[role=radio]').forEach((b) => b.setAttribute('aria-checked', b === ch));
    });
    document.addEventListener('change', (e) => { if (e.target.matches('[data-prof]')) { window.__prof = e.target.value; render(); } });
    addEventListener('hashchange', () => { window.__prof = null; render(); });
  }

  // Aulas experimentais de hoje, por professor (agora no mockup: 11:40).
  // estado: veio | faltou | sem (passou sem desfecho) | proxima | depois
  const AULAS = {
    heloisa: [
      ['07:00', 'Ana Clara Weber', 'Funcional', 'Aula 1 de 2', 'veio'],
      ['09:00', 'Pedro Lima', 'Funcional', 'Aula 1 de 3', 'faltou'],
      ['11:00', 'Tainá Rocha', 'Funcional', 'Aula 2 de 2', 'sem'],
      ['18:00', 'Juliana Costa', 'Funcional', 'Aula 1 de 2', 'proxima'],
      ['19:00', 'Roberto Saraiva', 'Funcional', 'Aula 1 de 3', 'depois'],
    ],
    pedro: [['17:00', 'Marcos Vinícius', 'Musculação', 'Aula 1 de 1', 'proxima']],
    leonardo: [['08:00', 'Cíntia Barros', 'Pilates', 'Aula 1 de 2', 'veio'], ['16:00', 'Helena Duarte', 'Pilates', 'Aula 1 de 2', 'proxima']],
  };
  const ROT = { veio: 'Compareceu', faltou: 'Não veio', sem: 'Sem desfecho', proxima: 'Próxima', depois: '' };
  const agenda = () => {
    const lista = AULAS[profVisto()] || [];
    const nome = F.PROFS[profVisto()];
    return `<section class="card ag"><div class="ag-h"><h3 class="d">Agenda de hoje</h3><span class="mut num">${lista.length ? `${lista.length} ${lista.length === 1 ? 'aula' : 'aulas'}` : ''}</span></div>
      <p class="mut ag-s">${gestor() ? `Aulas experimentais com ${nome}.` : 'Suas aulas experimentais.'}</p>
      ${lista.length ? `<ol class="ag-l">${lista.map(([h, n, mod, q, st]) => `<li class="ag-i st-${st}"><span class="ag-hr num">${h}</span><i class="ag-p" aria-hidden="true"></i>
        <span class="ag-nm"><a href="#">${n}</a><span class="mut">${mod}, ${q}</span></span>${ROT[st] ? `<span class="ag-e">${ROT[st]}${st === 'proxima' ? '<span class="sr"> (próxima)</span>' : ''}</span>` : ''}</li>`).join('')}</ol>
      <p class="ag-n2">Quem marca se o aluno veio é o consultor, na Meta dele.</p>` : '<p class="mut" style="padding:4px 0 6px">Nenhuma aula experimental hoje.</p>'}</section>`;
  };

  window.MP = { F, gestor, profVisto, meus, pendentes, feitos, motivo, ultimoContato, faixa, acoes, ligar, agenda, SETA };
})();
