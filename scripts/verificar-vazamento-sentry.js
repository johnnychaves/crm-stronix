// Confere, com o SDK do Sentry de verdade (não com um beforeSend espião),
// que a chave do Zap e o telefone do lead não saem das funções da api/ —
// e prova que a própria verificação enxergaria se saíssem.
//
//   node scripts/verificar-vazamento-sentry.js
//   node scripts/verificar-vazamento-sentry.js --round=normal     (só a rodada limpa)
//   node scripts/verificar-vazamento-sentry.js --round=sabotagem  (só a rodada vazante)
//
// Por que não confiar só no beforeSend (a versão anterior deste script, e o
// que ela deixava passar):
//   - com o header desligado na origem, todo evento mostra `null` — que é
//     exatamente o que também aparece quando o SDK simplesmente não anexou
//     pedido nenhum. As duas coisas pareciam iguais.
//   - só falhava com ZERO eventos capturados, então uma instância que
//     silenciosamente perdesse metade dos eventos ainda passava.
//   - conferia só NOMES de header, nunca o corpo, nem a query, nem variável
//     local de stacktrace.
//   - o cliente rodava no mesmo processo do SDK: o próprio pedido de saída
//     virava breadcrumb e contaminava o processo medido.
//
// Arquitetura (três papéis, um arquivo só, cada um em processo separado
// porque Sentry.init só vale a primeira vez por processo):
//   - orquestrador (sem flag): roda as duas rodadas, cada uma em processo
//     filho, e decide o resultado final.
//   - rodada (--round=normal|sabotagem): processo com o withSentry DE
//     VERDADE do repositório. Importa api/_sentry.js só depois de apontar
//     SENTRY_DSN para o ingest falso (init preguiçoso, igual produção), sobe
//     um handler no formato do handleMatch/GET (chave no header, telefones
//     no corpo ou na query, tudo em variável local, erro depois de um
//     await) e faz as chamadas através do processo auxiliar. O erro nasce em
//     dois formatos, e os dois precisam existir: dentro de uma função
//     auxiliar (imita o Firestore fora do ar, uma lib) e direto no próprio
//     handler (única forma de a variável local do handler — chave, telefones
//     — estar na pilha quando o V8 captura; um erro nascido dentro da
//     auxiliar não carrega isso, porque o handler está suspenso no await
//     quando o throw acontece, e uma sabotagem que só cobrisse esse formato
//     passaria "limpo" mesmo vazando variável local de verdade).
//   - auxiliar (--aux): ingest falso do Sentry em 127.0.0.1 (devolve cada
//     envelope ao pai por IPC) e o cliente http que chama a "função" da
//     rodada — separado de propósito, para o pedido de saída não virar
//     breadcrumb no processo que tem o SDK.
//
// O veredito nunca olha o que entra ou sai de um beforeSend: só o texto cru
// que o ingest falso recebeu de verdade. Nada sai desta máquina — o DSN é
// 127.0.0.1 e a porta é escolhida pelo SO (:0).
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = fileURLToPath(import.meta.url);
const REPO = path.dirname(path.dirname(AQUI));

const ROUND_TIMEOUT_MS = 15000;
const ORCH_TIMEOUT_MS = 40000;
const ESPERADO = 4; // uma chamada, um erro: 4 chamadas na sequência abaixo

// Marcas exclusivas desta verificação: improvável de aparecer em outro lugar
// do envelope por acaso, fácil de achar em texto cru.
const CHAVE = `szk_${'f1e2d3c4'.repeat(6)}`; // 52 chars, formato de generateZapKey (api/_zapAuth.js)
const TENANT = 'academia-verificacao';
const TEL_BODY = '5511987654321'; // telefone do lote, no corpo do POST match
const TEL_QUERY = '5521912345678'; // telefone do GET, na query
const CORPO_MARCA = 'CORPO_RECONHECIVEL_9f8e7d6c';
const QUERY_GET = `?tenant=${TENANT}&phone=${TEL_QUERY}`;

const MARCAS = {
  'chave do zap': CHAVE,
  'telefone do lote (corpo)': TEL_BODY,
  'telefone da query (GET)': TEL_QUERY,
  'query inteira do GET': QUERY_GET,
  'corpo reconhecivel': CORPO_MARCA,
};

const modoAux = process.argv.includes('--aux');
const flagRound = process.argv.find((a) => a.startsWith('--round='));
const rodadaPedida = flagRound ? flagRound.split('=')[1] : null;

if (modoAux) {
  await rodarAux();
} else if (rodadaPedida) {
  const resumo = await rodarRodada(rodadaPedida);
  process.exitCode = resumo.ok ? 0 : 1;
} else {
  await orquestrar();
}

// ============================= AUXILIAR =============================
// Ingest falso do Sentry + cliente http, em processo à parte da rodada, para
// o pedido de saída não gerar breadcrumb no processo que tem o SDK.
async function rodarAux() {
  const ingest = http.createServer((req, res) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      let corpo = Buffer.concat(partes);
      if (req.headers['content-encoding'] === 'gzip') {
        try { corpo = zlib.gunzipSync(corpo); } catch { /* envelope não veio comprimido de verdade */ }
      }
      process.send({ tipo: 'envelope', corpo: corpo.toString('utf8') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });

  await new Promise((ok) => ingest.listen(0, '127.0.0.1', ok));
  process.send({ tipo: 'pronto', porta: ingest.address().port });

  function chamar({ id, porta, metodo, caminho, corpo, headers }) {
    const dados = corpo ? JSON.stringify(corpo) : '';
    const req = http.request(
      {
        host: '127.0.0.1',
        port: porta,
        method: metodo,
        path: caminho,
        headers: { ...headers, ...(dados ? { 'content-length': Buffer.byteLength(dados) } : {}) },
      },
      (res) => { res.resume(); res.on('end', () => process.send({ tipo: 'resposta', id, status: res.statusCode })); }
    );
    req.on('error', (e) => process.send({ tipo: 'resposta', id, status: `erro:${e.message}` }));
    req.end(dados);
  }

  process.on('message', (m) => {
    if (m?.tipo === 'chamar') chamar(m);
    if (m === 'sair') ingest.close(() => process.exit(0));
  });
}

// ============================= RODADA =============================
// Processo com o withSentry de verdade do repositório, apontado para o
// ingest falso do processo auxiliar.
async function rodarRodada(variante) {
  const sabotar = variante === 'sabotagem';
  const watchdog = setTimeout(() => {
    console.error(`[${variante}] TIMEOUT: passou de ${ROUND_TIMEOUT_MS}ms sem terminar.`);
    process.exit(1);
  }, ROUND_TIMEOUT_MS);
  watchdog.unref?.();

  const aux = fork(AQUI, ['--aux'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const envelopes = [];
  const pendentes = new Map();
  const portaIngest = await new Promise((ok, falhar) => {
    aux.on('message', (m) => {
      if (m.tipo === 'pronto') ok(m.porta);
      else if (m.tipo === 'envelope') envelopes.push(m.corpo);
      else if (m.tipo === 'resposta') pendentes.get(m.id)?.(m.status);
    });
    aux.on('error', falhar);
    aux.on('exit', (code) => { if (code) falhar(new Error(`processo auxiliar saiu com código ${code}`)); });
  });

  // Aponta o DSN ANTES de importar api/_sentry.js: o módulo lê o DSN no load,
  // e Sentry.init só acontece dentro do handler (start() preguiçoso), igual
  // produção. Import dinâmico para isso valer mesmo com ESM.
  process.env.SENTRY_DSN = `http://chavepublica@127.0.0.1:${portaIngest}/1`;
  const { withSentry, SENTRY_OPTIONS } = await import(pathToFileURL(path.join(REPO, 'api/_sentry.js')).href);

  if (sabotar) {
    // Configuração deliberadamente vazante — o que o repositório tinha ANTES
    // da correção desta revisão. Se a verificação não pegar isso, ela não
    // prova nada na rodada normal.
    SENTRY_OPTIONS.dataCollection = {
      ...SENTRY_OPTIONS.dataCollection,
      httpHeaders: { request: true, response: false },
      // Sem isto, a sabotagem provava header, corpo e query, mas não
      // variável local: uma revisão trocou só estas duas linhas (deixando
      // header e corpo desligados) e o script disse "limpo" mesmo com
      // variável local vazando de verdade — ver revisao-sabotagem-vars.js.
      stackFrameVariables: true,
    };
    SENTRY_OPTIONS.includeLocalVariables = true; // liga a captura em si; dataCollection só permite ou bloqueia
    delete SENTRY_OPTIONS.integrations; // sem o maxIncomingRequestBodySize: 'none': corpo volta a vazar
    delete SENTRY_OPTIONS.beforeSend; // sem a segunda camada: nem header, corpo, query nem variável local são cortados
  }

  // Handler no formato do handleMatch/GET de produção: chave no header,
  // telefones em variável local (corpo no POST, query no GET), erro depois
  // de um await — como o Firestore fora do ar derrubaria de verdade.
  //
  // O erro nasce de dois jeitos, escolhido por chamada com o header
  // x-verificacao-modo-throw (plumbing só desta verificação, não existe em
  // produção):
  //   - "lib" (padrão): lança dentro de bancoIndisponivel(), imitando erro
  //     vindo de dentro de uma dependência.
  //   - "handler": lança direto aqui, depois de um await que suspende e
  //     retoma o PRÓPRIO handler — só assim chave/tenantId/telefone(s) estão
  //     de verdade na pilha quando o V8 captura variável local. Ver o
  //     comentário de arquitetura no topo do arquivo.
  async function bancoIndisponivel() {
    await new Promise((ok) => setImmediate(ok));
    throw new Error('Firestore indisponível (simulado)');
  }

  async function handlerSimulado(req, res) {
    const chave = req.headers['x-stronizap-key'];
    const direto = req.headers['x-verificacao-modo-throw'] === 'handler';
    if (req.method === 'GET') {
      const tenantId = req.query.tenant;
      const phone = req.query.phone;
      if (!chave || !tenantId) return res.status(401).json({ error: 'Credencial ausente' });
      if (direto) {
        await new Promise((ok) => setImmediate(ok));
        throw new Error(`Firestore indisponível (simulado, direto no handler) ${String(phone).length}`);
      }
      await bancoIndisponivel();
      return res.status(200).json({ found: false, phone });
    }
    const tenantId = req.body?.tenant;
    const phones = req.body?.phones;
    if (!chave || !tenantId || !Array.isArray(phones)) {
      return res.status(401).json({ error: 'Credencial ausente' });
    }
    if (direto) {
      await new Promise((ok) => setImmediate(ok));
      throw new Error(`Firestore indisponível (simulado, direto no handler) ${phones.length}`);
    }
    await bancoIndisponivel();
    return res.status(200).json({ found: [] });
  }

  // "Runtime da Vercel": servidor http cru, corpo lido por req.on('data') como raw-body.
  const envolvido = withSentry(handlerSimulado);
  const servidor = http.createServer(async (req, res) => {
    const texto = await new Promise((ok) => {
      const partes = [];
      req.on('data', (c) => partes.push(c));
      req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    });
    req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
    req.body = texto ? JSON.parse(texto) : undefined;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    try { await envolvido(req, res); } catch { if (!res.headersSent) res.statusCode = 500; }
    if (!res.writableEnded) res.end();
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const portaApp = servidor.address().port;

  let proximoId = 0;
  const chamar = (opts) => new Promise((ok) => {
    const id = ++proximoId;
    pendentes.set(id, ok);
    aux.send({ id, tipo: 'chamar', porta: portaApp, ...opts });
  });
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  const corpoMatch = { action: 'match', tenant: TENANT, phones: [TEL_BODY], marca: CORPO_MARCA };
  const headersPadrao = { 'x-stronizap-key': CHAVE, 'content-type': 'application/json', 'user-agent': 'verificar-vazamento-sentry' };
  // R2 a R4 lançam direto no handler (formato "handler"): é o único jeito de
  // telefone(s) e chave estarem na pilha para a variável local vazar. R1
  // mantém o formato "lib" original (dentro de bancoIndisponivel), para os
  // dois formatos continuarem cobertos.
  const headersDireto = { ...headersPadrao, 'x-verificacao-modo-throw': 'handler' };
  const sequencia = [
    { rotulo: 'R1 fria (Sentry.init acontece aqui) — POST match, erro dentro de uma lib', metodo: 'POST', caminho: '/api/zap', corpo: corpoMatch, headers: headersPadrao },
    { rotulo: 'R2 quente — POST match, erro direto no handler', metodo: 'POST', caminho: '/api/zap', corpo: corpoMatch, headers: headersDireto },
    { rotulo: 'R3 quente — GET com telefone na query, erro direto no handler', metodo: 'GET', caminho: `/api/zap${QUERY_GET}`, headers: headersDireto },
    { rotulo: 'R4 quente — POST match de novo, erro direto no handler', metodo: 'POST', caminho: '/api/zap', corpo: corpoMatch, headers: headersDireto },
  ];

  console.log(`\n===== rodada ${variante} =====`);
  for (const passo of sequencia) {
    const status = await chamar(passo);
    console.log(`  ${passo.rotulo}: HTTP ${status}`);
  }
  await esperar(300); // folga além do flush(2000) que já roda dentro de cada chamada

  servidor.close();
  aux.send('sair');
  await new Promise((ok) => { aux.once('exit', ok); setTimeout(ok, 1500); });
  clearTimeout(watchdog);

  // ---- Análise: só o que chegou de verdade ao ingest falso. Nunca o que um
  // beforeSend devolveria — é exatamente essa distinção que a versão
  // anterior deste script não fazia. ----
  const eventos = [];
  envelopes.forEach((corpoEnvelope, indiceEnvelope) => {
    for (const { cabecalhoItem, payload } of itensDoEnvelope(corpoEnvelope)) {
      if (cabecalhoItem?.type === 'event' && payload) eventos.push({ indiceEnvelope, evento: payload });
    }
  });

  const achados = [];
  envelopes.forEach((corpo, i) => {
    for (const [nome, valor] of Object.entries(MARCAS)) {
      if (corpo.includes(valor)) achados.push(`${nome} (envelope ${i + 1})`);
    }
  });

  console.log(`chamadas: ${sequencia.length} | envelopes recebidos: ${envelopes.length} | eventos de erro: ${eventos.length}`);
  eventos.forEach(({ evento }, i) => {
    const framesComVars = (evento.exception?.values || []).flatMap((ex) =>
      (ex.stacktrace?.frames || []).filter((f) => f.vars).map((f) => `${f.function}{${Object.keys(f.vars).join(',')}}`));
    console.log(`  evento ${i + 1}: request.url=${JSON.stringify(evento.request?.url)} | headers=${JSON.stringify(Object.keys(evento.request?.headers || {}))} | request.data=${evento.request?.data === undefined ? 'ausente' : 'PRESENTE'} | frames com vars=${JSON.stringify(framesComVars)}`);
  });
  console.log(`marcas encontradas no texto cru dos envelopes: ${achados.length ? JSON.stringify(achados) : 'nenhuma'}`);

  const faltamEventos = eventos.length < ESPERADO;
  // "Instância aquecida" = tudo menos o primeiro evento (o próprio vazamento
  // original só aparecia da segunda requisição em diante).
  const quentesSemUrl = eventos.slice(1).filter(({ evento }) => !evento.request?.url);
  const vazou = achados.length > 0;

  let ok;
  let motivo;
  if (faltamEventos) {
    ok = false;
    motivo = `menos eventos que o esperado (${eventos.length}/${ESPERADO}) — evento perdido não prova nada`;
  } else if (!sabotar && quentesSemUrl.length > 0) {
    ok = false;
    motivo = `${quentesSemUrl.length} evento(s) da instância aquecida sem request.url — a rodada não prova que o pedido foi mesmo capturado e limpo`;
  } else if (!sabotar) {
    ok = !vazou;
    motivo = vazou ? 'vazou marca fora do esperado na rodada normal' : 'nenhuma marca encontrada — rodada normal limpa';
  } else {
    ok = vazou;
    motivo = vazou ? 'a sabotagem vazou, como esperado: a verificação enxergaria se o vazamento real voltasse' : 'a sabotagem NÃO vazou — a verificação está cega e não serve de gate';
  }

  console.log(`resultado da rodada ${variante}: ${ok ? 'OK' : 'FALHOU'} — ${motivo}`);

  const resumo = { variante, ok, motivo, eventos: eventos.length, esperado: ESPERADO, vazou, achados };
  if (process.send) process.send({ tipo: 'resumo', resumo });
  return resumo;
}

function itensDoEnvelope(corpoEnvelope) {
  const linhas = corpoEnvelope.split('\n').filter((l) => l.length > 0);
  const itens = [];
  // linhas[0] é o cabeçalho do envelope (event_id, dsn, sent_at); o resto vem
  // em pares (cabeçalho do item, payload). Attachment binário quebraria essa
  // suposição, mas esta verificação só manda item de evento.
  for (let i = 1; i < linhas.length; i += 2) {
    if (i + 1 >= linhas.length) break;
    let cabecalhoItem;
    let payload;
    try { cabecalhoItem = JSON.parse(linhas[i]); } catch { continue; }
    try { payload = JSON.parse(linhas[i + 1]); } catch { payload = undefined; }
    itens.push({ cabecalhoItem, payload });
  }
  return itens;
}

// ============================= ORQUESTRADOR =============================
async function orquestrar() {
  const watchdog = setTimeout(() => {
    console.error(`TIMEOUT GERAL: passou de ${ORCH_TIMEOUT_MS}ms sem terminar as duas rodadas.`);
    process.exit(1);
  }, ORCH_TIMEOUT_MS);
  watchdog.unref?.();

  const normal = await executarRodadaEmProcesso('normal');
  const sabotagem = await executarRodadaEmProcesso('sabotagem');
  clearTimeout(watchdog);

  console.log('\n===== resumo final =====');
  console.log(`rodada normal:    ${normal.ok ? 'OK' : 'FALHOU'} — ${normal.motivo}`);
  console.log(`rodada sabotagem: ${sabotagem.ok ? 'OK' : 'FALHOU'} — ${sabotagem.motivo}`);

  const tudoOk = normal.ok && sabotagem.ok;
  console.log(tudoOk
    ? 'Sentry não recebe a chave do Zap nem telefone, e a sabotagem prova que esta verificação enxergaria se recebesse.'
    : 'FALHOU — ver o motivo de cada rodada acima.');
  process.exit(tudoOk ? 0 : 1);
}

function executarRodadaEmProcesso(variante) {
  return new Promise((resolver) => {
    const filho = fork(AQUI, [`--round=${variante}`], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let resumo = null;
    filho.on('message', (m) => { if (m?.tipo === 'resumo') resumo = m.resumo; });
    filho.on('exit', (code) => {
      resolver(resumo ?? { variante, ok: false, motivo: `a rodada terminou (código ${code}) sem publicar resultado` });
    });
    filho.on('error', (e) => resolver({ variante, ok: false, motivo: `falha ao iniciar a rodada: ${e.message}` }));
  });
}
