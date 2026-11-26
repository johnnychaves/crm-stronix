import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, ListChecks, ShieldCheck } from 'lucide-react';
import { isValidCpf } from '../../lib/brazilLookups.js';
import './avaliar.css';

// A página PÚBLICA da pesquisa de NPS dos alunos (/avaliar/<academia>/<código>,
// PR 5 do perfil do professor), aberta no celular, sem login, pelo link ou pelo
// QR code do professor. Desenho do mockup B
// (docs/superpowers/specs/mockups/2026-11-24-nps-pagina-publica-b.html): o CPF,
// uma pergunta por tela com a régua de 0 a 10 e o rosto que muda com a nota, o
// comentário com o resumo das notas e o obrigado. Quem confere tudo é o
// servidor (api/_npsPublico.js). O texto não diz "professor" nem "professora":
// a página não sabe o gênero de quem dá a aula.
const COMENTARIO_MAX = 500;
const FONTES = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Saira:wdth,wght@75..100,600..800&display=swap';
const so = (v) => String(v || '').replace(/\D/g, '').slice(0, 11);
const mascara = (d) => d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
const iniciais = (nome) => String(nome || '').trim().slice(0, 2).toUpperCase();
const palavra = (v) => (v === 0 ? 'Péssimo' : v <= 2 ? 'Muito ruim' : v <= 4 ? 'Ruim' : v <= 6 ? 'Mais ou menos' : v <= 8 ? 'Bom' : v === 9 ? 'Muito bom' : 'Excelente');

const PARADAS = [[0, [229, 17, 61]], [3, [234, 86, 54]], [6, [240, 188, 74]], [10, [61, 190, 122]]];
function corDe(v) {
  for (let i = 1; i < PARADAS.length; i += 1) {
    const [a, ca] = PARADAS[i - 1];
    const [b, cb] = PARADAS[i];
    if (v <= b) {
      const t = (v - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`;
    }
  }
  return 'rgb(61,190,122)';
}

const TINTA = '#1B1C1A';
// O rosto que muda com a nota: bravo no 0, sorrindo no 8, rindo no 10.
function Rosto({ nota, className = 'rosto' }) {
  const v = nota;
  let olhos = (
    <>
      <ellipse cx="22" cy="27" rx="3.6" ry="4.2" fill={TINTA} /><ellipse cx="42" cy="27" rx="3.6" ry="4.2" fill={TINTA} />
      <circle cx="23.2" cy="25.6" r="1.2" fill="#fff" /><circle cx="43.2" cy="25.6" r="1.2" fill="#fff" />
    </>
  );
  let extra = null;
  let boca;
  if (v == null) {
    boca = <path d="M23 44 H41" stroke={TINTA} strokeWidth="3.6" strokeLinecap="round" />;
  } else if (v >= 9) {
    olhos = (
      <>
        <path d="M16 29 Q22 20 28 29" stroke={TINTA} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        <path d="M36 29 Q42 20 48 29" stroke={TINTA} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      </>
    );
    boca = (
      <>
        <path d={`M18 38 Q32 ${v === 10 ? 60 : 55} 46 38 Z`} fill={TINTA} />
        {v === 10 && <path d="M25 47.5 Q32 55 39 47.5 Q32 51 25 47.5" fill="#F0607A" />}
      </>
    );
    extra = <><ellipse cx="14" cy="37" rx="4.5" ry="3" fill="#ff7b6b" opacity=".55" /><ellipse cx="50" cy="37" rx="4.5" ry="3" fill="#ff7b6b" opacity=".55" /></>;
  } else {
    const c = -12 + (v / 8) * 23;
    boca = <path d={`M20 ${44 - c / 4} Q32 ${44 + c} 44 ${44 - c / 4}`} stroke={TINTA} strokeWidth="3.8" fill="none" strokeLinecap="round" />;
    extra = (
      <>
        {v <= 2 && <><path d="M14 20 L26 15.5" stroke={TINTA} strokeWidth="3" strokeLinecap="round" /><path d="M50 20 L38 15.5" stroke={TINTA} strokeWidth="3" strokeLinecap="round" /></>}
        {v === 0 && <path d="M45 32 Q41.5 39 45 41.5 Q48.5 39 45 32 Z" fill="#8ccff8" />}
        {v >= 7 && <><ellipse cx="14" cy="37" rx="4" ry="2.6" fill="#ff7b6b" opacity=".4" /><ellipse cx="50" cy="37" rx="4" ry="2.6" fill="#ff7b6b" opacity=".4" /></>}
      </>
    );
  }
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="currentColor" />
      <path d="M10 22 A26 26 0 0 1 30 6" stroke="#fff" strokeOpacity=".22" strokeWidth="3" fill="none" strokeLinecap="round" />
      {olhos}{extra}{boca}
    </svg>
  );
}

function Avatar({ prof, mini = false }) {
  return (
    <span className={mini ? 'av av-mini' : 'av'} aria-hidden={mini || undefined}>
      {prof.photoUrl ? <img src={prof.photoUrl} alt={mini ? '' : `Foto de ${prof.nome}`} /> : <span>{iniciais(prof.nome)}</span>}
    </span>
  );
}

function Topo({ info }) {
  return <div className="topo">{info.logoUrl ? <img src={info.logoUrl} alt={info.academia} /> : <b>{info.academia}</b>}</div>;
}

async function chamar(body) {
  const r = await fetch('/api/tenant-resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const dados = await r.json().catch(() => ({}));
  return { status: r.status, ...dados };
}

const ALERTAS = {
  fora: ['Não encontramos esse CPF na turma.', 'Confira com a recepção.'],
  ja: ['Você já respondeu esta pesquisa.', 'Obrigado! Cada pessoa responde uma vez.'],
  limite: ['Muitas tentativas.', 'Aguarde alguns minutos e tente de novo.'],
  erro: ['Não deu para continuar agora.', 'Tente de novo em instantes.'],
};

export function AvaliarScreen({ slug, code }) {
  const [info, setInfo] = useState(null);
  const [tela, setTela] = useState('cpf'); // cpf | perguntas | obrigado
  const [cpf, setCpf] = useState('');
  const [erroCpf, setErroCpf] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [nome, setNome] = useState('');
  const [passo, setPasso] = useState(0);
  const [notas, setNotas] = useState([]);
  const [comentario, setComentario] = useState('');
  const [editando, setEditando] = useState(false);
  const [website, setWebsite] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState('');
  const appRef = useRef(null);
  const cpfRef = useRef(null);
  const tituloRef = useRef(null);
  const sliderRef = useRef(null);
  const [focarTitulo, setFocarTitulo] = useState(0);

  // As fontes do mockup, só nesta página.
  useEffect(() => {
    if (document.querySelector('link[data-avaliar-fontes]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTES;
    l.dataset.avaliarFontes = '';
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    let cancelado = false;
    chamar({ action: 'nps-info', slug, code })
      .then((r) => { if (!cancelado) setInfo(r.status === 200 ? r : { found: false, falhou: true }); })
      .catch(() => { if (!cancelado) setInfo({ found: false, falhou: true }); });
    return () => { cancelado = true; };
  }, [slug, code]);

  useEffect(() => {
    if (!focarTitulo) return;
    tituloRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [focarTitulo]);

  const perguntas = info?.pesquisa?.perguntas || [];
  const N = perguntas.length;
  const nota = passo < N ? notas[passo] : null;
  const media = notas.length && notas.every(Number.isInteger) ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
  const tom = tela === 'perguntas' ? (passo < N ? nota : media) : null;
  const vars = { '--cor': tom == null ? '#6b6c66' : corDe(tom), '--amb': tom == null ? '#EA5636' : corDe(tom) };
  const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const confete = (el, n) => {
    const app = appRef.current;
    if (reduz || !app || !el) return;
    const r = el.getBoundingClientRect();
    const b = app.getBoundingClientRect();
    const x = r.left - b.left + r.width / 2;
    const y = r.top - b.top + r.height / 2;
    const cores = ['#EA5636', '#F0BC4A', '#3DBE7A', '#FFFFFF', '#E5113D'];
    for (let i = 0; i < n; i += 1) {
      const p = document.createElement('i');
      p.className = 'cf';
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 120;
      p.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 70}px;--r:${Math.random() * 720 - 360}deg;background:${cores[i % cores.length]}`;
      app.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  };

  const conferirCpf = async (e) => {
    e.preventDefault();
    setAlerta(null);
    const d = so(cpf);
    if (d.length < 11) { setErroCpf(d.length ? 'Faltam números no CPF.' : 'Digite o seu CPF.'); cpfRef.current?.focus(); return; }
    if (!isValidCpf(d)) { setErroCpf('Esse CPF não é válido. Confira os números.'); cpfRef.current?.focus(); return; }
    setEnviando(true);
    try {
      const r = await chamar({ action: 'nps-check', slug, code, cpf: d });
      if (r.ok) {
        setNome(r.nome || '');
        setNotas(perguntas.map(() => null));
        setPasso(0);
        setEditando(false);
        setComentario('');
        setStatus('');
        setTela('perguntas');
        setFocarTitulo((n) => n + 1);
      } else if (r.motivo === 'fechada') setInfo((i) => ({ ...i, pesquisa: null }));
      else if (r.motivo === 'link') setInfo({ found: false });
      else setAlerta(r.status === 429 ? 'limite' : ALERTAS[r.motivo] ? r.motivo : 'erro');
    } catch {
      setAlerta('erro');
    } finally {
      setEnviando(false);
    }
  };

  const marcar = (v) => {
    const antes = notas[passo];
    setNotas((ns) => ns.map((x, i) => (i === passo ? v : x)));
    setStatus('');
    if (v === 10 && antes !== 10) confete(document.getElementById('avl-rosto'), 34);
  };

  const irPara = (p) => { setPasso(p); setStatus(''); setFocarTitulo((n) => n + 1); };
  const avancar = async () => {
    if (passo < N && nota == null) {
      setStatus('Arraste a régua para dar a nota.');
      sliderRef.current?.focus();
      return;
    }
    if (passo < N) {
      if (editando) { setEditando(false); irPara(N); } else irPara(passo + 1);
      return;
    }
    setEnviando(true);
    setStatus('Enviando…');
    try {
      const r = await chamar({
        action: 'nps-answer', slug, code, cpf: so(cpf), website,
        notas: Object.fromEntries(perguntas.map((q, i) => [q.id, notas[i]])),
        comentario: comentario.trim(),
      });
      if (r.ok) {
        setTela('obrigado');
        setStatus('');
        setFocarTitulo((n) => n + 1);
        setTimeout(() => confete(document.getElementById('avl-selo'), 60), 50);
      } else if (r.motivo === 'ja' || r.motivo === 'fora') {
        setTela('cpf');
        setAlerta(r.motivo);
        setStatus('');
      } else if (r.motivo === 'fechada') {
        setInfo((i) => ({ ...i, pesquisa: null }));
      } else if (r.motivo === 'link') {
        setInfo({ found: false });
      } else {
        setStatus(r.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' : 'Não deu para enviar agora. Tente de novo em instantes.');
      }
    } catch {
      setStatus('Não deu para enviar agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  };
  const voltar = () => {
    if (editando) { setEditando(false); irPara(N); return; }
    if (passo === 0) { setTela('cpf'); setStatus(''); requestAnimationFrame(() => cpfRef.current?.focus()); return; }
    irPara(passo - 1);
  };

  let conteudo;
  if (!info) {
    conteudo = <section className="tela"><p className="carregando" role="status">Carregando a pesquisa…</p></section>;
  } else if (!info.found) {
    conteudo = (
      <section className="tela" aria-labelledby="avl-inv">
        <div className="corpo">
          <h1 id="avl-inv" style={{ marginTop: 60 }}>Link fora do ar</h1>
          <div className="caixa">
            {info.falhou
              ? <><b>Não deu para abrir a pesquisa.</b><p>Confira a internet e recarregue a página.</p></>
              : <><b>Este link não está funcionando.</b><p>Confira o link com quem dá a sua aula ou na recepção.</p></>}
          </div>
        </div>
      </section>
    );
  } else if (!info.pesquisa) {
    conteudo = (
      <section className="tela" aria-labelledby="avl-fechada">
        <Topo info={info} />
        <div className="corpo">
          <Cabecalho prof={info.professor} />
          <h1 id="avl-fechada">Avalie as aulas de <em>{info.professor.nome}</em></h1>
          <div className="caixa"><b>Nenhuma pesquisa aberta agora.</b><p>Este link volta a funcionar quando a próxima pesquisa abrir.</p></div>
        </div>
      </section>
    );
  } else if (tela === 'obrigado') {
    conteudo = (
      <section className="tela" aria-labelledby="avl-fim">
        <Topo info={info} />
        <div className="corpo">
          <div className="selo" id="avl-selo">{info.logoUrl ? <img src={info.logoUrl} alt="" /> : <Check aria-hidden="true" />}</div>
          <h1 id="avl-fim" ref={tituloRef} tabIndex={-1}>Obrigado!</h1>
          <p className="sub">Sua resposta foi registrada. Pode fechar esta página.</p>
        </div>
      </section>
    );
  } else if (tela === 'perguntas') {
    const ultimo = passo === N;
    conteudo = (
      <section className="tela" aria-label="Pesquisa">
        <div className="barra">
          <button type="button" className="volta" onClick={voltar} aria-label={editando ? 'Voltar para o resumo' : passo === 0 ? 'Voltar para o CPF' : 'Voltar para a pergunta anterior'}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <div className="segs" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${N + 1}, 1fr)` }}>
            {Array.from({ length: N + 1 }, (_, i) => <i key={i} className={i <= passo ? 'on' : undefined} />)}
          </div>
          <span className="conta num" aria-hidden="true">{passo < N ? `${passo + 1}/${N}` : ''}</span>
        </div>
        <div className="corpo">
          <p className="sobre">
            <Avatar prof={info.professor} mini />
            <span>{passo === 0 && nome && <>Oi, <b>{nome}</b>! </>}Avaliando as aulas de <b>{info.professor.nome}</b></span>
          </p>
          {!ultimo ? (
            <div>
              <p className="np num">Pergunta {passo + 1} de {N}</p>
              <h2 className="pt" id="avl-pt" ref={tituloRef} tabIndex={-1}>{perguntas[passo].texto}</h2>
              <div className={nota == null ? 'palco vazio' : 'palco'}>
                <span id="avl-rosto"><Rosto nota={nota} /></span>
                <b className="valor num">{nota == null ? '–' : nota}</b>
                <span className="rotulo">{nota == null ? 'Arraste para dar a nota' : palavra(nota)}</span>
              </div>
              <div className={nota == null ? 'regua vazio' : 'regua'}>
                <input
                  ref={sliderRef}
                  key={passo}
                  className="slider"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  defaultValue={nota ?? 5}
                  aria-labelledby="avl-pt"
                  aria-valuetext={nota == null ? 'Sem nota ainda. Use as setas para escolher de 0 a 10.' : `${nota}, ${palavra(nota)}`}
                  onChange={(e) => marcar(Number(e.target.value))}
                  onPointerUp={(e) => marcar(Number(e.currentTarget.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && nota != null) avancar(); }}
                />
                <div className="pontas" aria-hidden="true"><span><b>0</b>pior nota</span><span><b>10</b>melhor nota</span></div>
              </div>
            </div>
          ) : (
            <div>
              <p className="np">Última etapa</p>
              <h2 className="pt" ref={tituloRef} tabIndex={-1}>Quer contar mais alguma coisa?</h2>
              <p className="sub">É opcional. Só a gestão da academia lê o comentário.</p>
              <div className="mini" role="group" aria-label="Suas notas">
                {notas.map((n, i) => (
                  <button key={perguntas[i].id} type="button" style={{ color: corDe(n) }} aria-label={`Pergunta ${i + 1}, nota ${n}. Mudar a nota`} onClick={() => { setEditando(true); irPara(i); }}>
                    <Rosto nota={n} className="" />
                    <b className="num">{n}</b>
                    <span className="muda">Mudar</span>
                  </button>
                ))}
              </div>
              <p className="dica">Toque numa nota para mudar.</p>
              <div className="com">
                <label htmlFor="avl-com">Seu comentário</label>
                <textarea id="avl-com" maxLength={COMENTARIO_MAX} placeholder="Escreva aqui, se quiser" aria-describedby="avl-com-cont" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                <p className="cont num" id="avl-com-cont">{comentario.length} de {COMENTARIO_MAX}</p>
              </div>
              <div className="oculto" aria-hidden="true">
                <label htmlFor="avl-site">Não preencha</label>
                <input id="avl-site" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <div className="acao">
          <p className="status" role="status">{status}</p>
          <div className="botoes">
            {passo > 0 && !editando && <button type="button" className="volta2" onClick={voltar}>Voltar</button>}
            <button type="button" className="btn" aria-disabled={(passo < N && nota == null) || enviando} onClick={() => { if (!enviando) avancar(); }}>
              {ultimo ? 'Enviar resposta' : editando ? 'Salvar nota' : passo === N - 1 ? 'Continuar' : 'Próxima'}
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    );
  } else {
    const [titulo, texto] = alerta ? ALERTAS[alerta] : [];
    conteudo = (
      <form className="tela" noValidate aria-labelledby="avl-cpf-t" onSubmit={conferirCpf}>
        <Topo info={info} />
        <div className="corpo">
          <Cabecalho prof={info.professor} />
          <h1 id="avl-cpf-t">Avalie as aulas de <em>{info.professor.nome}</em></h1>
          <div className="fatos">
            <span><ListChecks aria-hidden="true" />{N === 1 ? '1 pergunta' : `${N} perguntas`}</span>
            <span><Clock aria-hidden="true" />Menos de 1 minuto</span>
          </div>
          <div className="campo">
            <label htmlFor="avl-cpf">Para começar, seu CPF</label>
            <input
              ref={cpfRef}
              id="avl-cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpf}
              aria-invalid={erroCpf ? true : undefined}
              aria-describedby="avl-cpf-erro avl-cpf-priv"
              onChange={(e) => { setCpf(mascara(so(e.target.value))); setErroCpf(''); setAlerta(null); }}
            />
            <p className="erro" id="avl-cpf-erro" aria-live="polite">{erroCpf}</p>
            <p className="priv" id="avl-cpf-priv">
              <ShieldCheck aria-hidden="true" />
              <span>Usamos o seu CPF só para confirmar que você é aluno e para que cada pessoa responda uma vez. A gestão da academia vê a sua resposta. Quem dá a aula vê só o resultado da turma, sem nomes.</span>
            </p>
            {alerta && <div className="alerta" role="alert"><b>{titulo}</b>{texto}</div>}
          </div>
        </div>
        <div className="acao">
          <button className="btn" type="submit" aria-disabled={enviando || undefined}>{enviando ? 'Conferindo…' : 'Começar'}<ArrowRight aria-hidden="true" /></button>
        </div>
      </form>
    );
  }

  return (
    <div className="avl" lang="pt-BR" style={vars}>
      <main className="app" ref={appRef}>
        <div className="brilho" aria-hidden="true" />
        {conteudo}
      </main>
    </div>
  );
}

function Cabecalho({ prof }) {
  const mods = prof.modalidades || [];
  return (
    <div className="prof">
      <Avatar prof={prof} />
      <div><b>{prof.nome}</b>{mods.length > 0 && <small>{mods.join(' e ')}</small>}</div>
    </div>
  );
}
