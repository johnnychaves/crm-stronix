// Auditoria e rollback de um lote de importação de clientes (PR #195, já em
// produção). Lê os leads, contratos e interações gravados por uma importação
// e mostra, ou desfaz, o que aconteceu.
//
// CONTEXTO: o dono de uma academia (tenant de teste) rodou uma importação e o
// resultado pareceu errado: muitos contratos sem valor e sem plano, e
// suspeita de gente duplicada na base. Este script não adivinha nada: ele lê
// os carimbos que a própria importação grava (importBatchId, importedBy,
// importSource, importedAt em stronix_leads / stronix_contratos /
// stronix_interactions) e cruza com o resto da base pra explicar o que
// aconteceu, além de permitir desfazer um lote específico.
//
// MODOS (o padrão, sem nenhum, é --list):
//   --list                lista os lotes de importação do tenant, do mais
//                          antigo pro mais novo.
//   --inspect=<id|last>   detalha um lote: resumo, contratos (com/sem plano
//                          do catálogo, com/sem valor, início inferido),
//                          clientes sem vigência registrada, duplicatas na
//                          base (CPF, telefone ou nome batendo com outro
//                          cadastro) e um diagnóstico curto.
//   --undo=<id|last>      desfaz um lote: apaga as interações e os contratos
//                          do lote e os leads que a importação CRIOU, e lista
//                          (sem apagar) os leads que já existiam e só foram
//                          atualizados ou promovidos a cliente.
//
// O id do lote aceita o id completo ou só os 8 primeiros caracteres (o "id
// curto" que --list e --inspect mostram, mesma convenção do shortId() do
// app, em ContractModal.jsx). "last" pega o lote mais recente (maior
// importedAt entre os docs do lote).
//
// FLAGS:
//   --tenant=<id>          obrigatório em todo modo: id do tenant (academia).
//   --apply                com --undo, grava de verdade. Sem isso é só
//                          simulação (o padrão): mostra o plano e não grava
//                          nada. Sem pedido de confirmação: a própria flag já
//                          é a confirmação.
//   --include-promovidos   com --undo, além de apagar o que a importação
//                          criou, também limpa os carimbos de importação e o
//                          resumo de contrato dos leads que já existiam antes
//                          (não mexe em status / lifecycleStage /
//                          lifecycleBucket: o estágio anterior à importação
//                          não é conhecido).
//
// Uso (mesmas credenciais Admin das funções api/, escolha UMA):
//   A) RECOMENDADO (sem colar a private key): baixe o serviceAccount.json
//      (Firebase Console > Configurações do projeto > Contas de serviço >
//      Gerar nova chave privada) e aponte:
//        GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccount.json \
//        node scripts/import-audit.js --tenant=academia-teste --list
//   B) as 3 vars (mesmas das funções api/):
//        FIREBASE_ADMIN_PROJECT_ID=... \
//        FIREBASE_ADMIN_CLIENT_EMAIL=... \
//        FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
//        node scripts/import-audit.js --tenant=academia-teste --inspect=last
//
// Exemplos:
//   node scripts/import-audit.js --tenant=academia-teste --list
//   node scripts/import-audit.js --tenant=academia-teste --inspect=last
//   node scripts/import-audit.js --tenant=academia-teste --undo=last
//   node scripts/import-audit.js --tenant=academia-teste --undo=last --apply
//   node scripts/import-audit.js --tenant=academia-teste --undo=last --apply --include-promovidos
//
// --list e --inspect só leem. --undo só grava com --apply.

import process from 'node:process';
import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Helpers puros, copiados (scripts admin não importam de src/ por convenção;
// se a regra mudar lá, atualizar aqui também):
//   onlyDigits/normalize ....... src/lib/globalSearch.js
//   normalizeName .............. src/lib/clientImport.js (normalize + espaços
//                                 colapsados)
// ---------------------------------------------------------------------------
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const normalizeName = (raw) => normalize(String(raw ?? '').replace(/\s+/g, ' ').trim());

// Timestamp do Firestore, Date ou null -> Date local, ou null.
function toJsDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  return null;
}

// Mesma entrada de toJsDate, formatada em "dd/mm/aaaa hh:mm" (hora local) ou
// "sem data" quando não dá pra converter.
function formatDate(val) {
  const d = toJsDate(val);
  if (!d) return 'sem data';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}

// Id curto pra exibição: mesma convenção do app (shortId() em ContractModal.jsx).
const shortId = (id) => (id ? String(id).slice(0, 8).toUpperCase() : '');

// Mascaram CPF/telefone pra não jogar o dado inteiro no terminal. Só disfarça
// quando o tamanho bate com o formato esperado (11 dígitos de CPF; 10 ou 11
// de telefone); fora disso mostra só "***" pra não sugerir um formato que os
// dígitos sujos não têm.
function maskCPF(digits) {
  const d = onlyDigits(digits);
  if (d.length !== 11) return d ? '***' : '';
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}
function maskPhone(digits) {
  const d = onlyDigits(digits);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(7, 11)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ****-${d.slice(6, 10)}`;
  return d ? '***' : '';
}

// ---------------------------------------------------------------------------
// Argumentos. A validação do --tenant precisa vir ANTES de checar as
// credenciais: "node scripts/import-audit.js" sem nada tem que reclamar do
// tenant faltando sem exigir credencial nenhuma.
// ---------------------------------------------------------------------------
const RAW_ARGS = process.argv.slice(2);
const APPLY = RAW_ARGS.includes('--apply');
const INCLUDE_PROMOVIDOS = RAW_ARGS.includes('--include-promovidos');

function flagValue(name) {
  const prefix = `--${name}=`;
  const hit = RAW_ARGS.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const TENANT = flagValue('tenant');
const INSPECT_ARG = flagValue('inspect');
const UNDO_ARG = flagValue('undo');
const MODE = UNDO_ARG !== null ? 'undo' : (INSPECT_ARG !== null ? 'inspect' : 'list');
const BATCH_ARG = MODE === 'undo' ? UNDO_ARG : INSPECT_ARG;

if (!TENANT) {
  console.error(
    'Faltou --tenant=<id>.\n' +
    'Uso: node scripts/import-audit.js --tenant=<id> [--list | --inspect=<batchId|last> | --undo=<batchId|last>] [--apply] [--include-promovidos]'
  );
  process.exit(1);
}
if (MODE !== 'list' && !BATCH_ARG) {
  console.error(`Faltou o id do lote. Use --${MODE}=<batchId> ou --${MODE}=last.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Credenciais Admin (mesmo caminho A/B documentado no backfill-scale-fields.js).
// ---------------------------------------------------------------------------
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const hasCertVars = Boolean(projectId && clientEmail && privateKey);
const hasAdc = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

if (!hasCertVars && !hasAdc) {
  console.error(
    'Faltam credenciais Admin. Escolha UMA:\n' +
    '  A) GOOGLE_APPLICATION_CREDENTIALS=<caminho do serviceAccount.json> (recomendado, sem colar a private key)\n' +
    '  B) as 3 vars FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY'
  );
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp(hasAdc
    ? { credential: admin.credential.applicationDefault() }
    : { credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const db = admin.firestore();

const LEADS_PATH = 'stronix_leads';
const CONTRACTS_PATH = 'stronix_contratos';
const INTERACTIONS_PATH = 'stronix_interactions';

const dataCol = (path) => db.collection('artifacts').doc(TENANT).collection('public').doc('data').collection(path);

// ---------------------------------------------------------------------------
// Carga: lê as três coleções inteiras uma vez só e trabalha em memória (uma
// academia tem, no máximo, alguns milhares de docs, igual aos outros backfills).
// ---------------------------------------------------------------------------
async function loadAll() {
  const [leadsSnap, contractsSnap, interactionsSnap] = await Promise.all([
    dataCol(LEADS_PATH).get(),
    dataCol(CONTRACTS_PATH).get(),
    dataCol(INTERACTIONS_PATH).get(),
  ]);
  const toRecord = (doc) => ({ ...(doc.data() || {}), id: doc.id, ref: doc.ref });
  return {
    leads: leadsSnap.docs.map(toRecord),
    contracts: contractsSnap.docs.map(toRecord),
    interactions: interactionsSnap.docs.map(toRecord),
  };
}

// ---------------------------------------------------------------------------
// Agrupamento por lote
// ---------------------------------------------------------------------------
function groupByBatch({ leads, contracts, interactions }) {
  const batches = new Map();
  const ensure = (id) => {
    if (!batches.has(id)) batches.set(id, { id, leads: [], contracts: [], interactions: [] });
    return batches.get(id);
  };
  for (const l of leads) if (l.importBatchId) ensure(l.importBatchId).leads.push(l);
  for (const c of contracts) if (c.importBatchId) ensure(c.importBatchId).contracts.push(c);
  for (const i of interactions) if (i.importBatchId) ensure(i.importBatchId).interactions.push(i);
  return batches;
}

// Menor importedAt entre os docs do lote: é a "data" do lote nas listagens e
// o critério de "last" (o lote com a maior data entre todos os lotes).
function batchDate(batch) {
  let min = null;
  for (const doc of [...batch.leads, ...batch.contracts, ...batch.interactions]) {
    const d = toJsDate(doc.importedAt);
    if (d && (!min || d < min)) min = d;
  }
  return min;
}

// Um lead é considerado CRIADO pela importação quando o source começa com
// "Importação " (sourceField, em src/lib/clientImport.js, só grava isso em
// cadastro novo). É a única marca disponível: a primeira versão da
// importação não gravou uma flag explícita tipo isNew. Um lead criado por um
// lote MAIS ANTIGO e tocado de novo por ESTE lote também conta como "criado"
// aqui, porque o importBatchId do lead é sobrescrito pro lote mais novo a
// cada toque (o source não muda, só os carimbos de importação mudam). Isso é
// seguro: o lote mais antigo também criou esse lead, então ele nunca é um
// cadastro manual sendo apagado por engano, só um lead de importação sendo
// atribuído ao lote errado no --undo.
function isCreatedByImport(lead) {
  return String(lead.source || '').startsWith('Importação ');
}

function summarizeBatch(batch) {
  const created = batch.leads.filter(isCreatedByImport);
  const promoted = batch.leads.filter((l) => !isCreatedByImport(l));
  const anyDoc = batch.leads[0] || batch.contracts[0] || batch.interactions[0] || {};
  return {
    id: batch.id,
    date: batchDate(batch),
    source: anyDoc.importSource || 'desconhecida',
    importedBy: anyDoc.importedBy || 'desconhecido',
    leadsTouched: batch.leads.length,
    leadsCreated: created.length,
    leadsPromoted: promoted.length,
    contracts: batch.contracts.length,
    interactions: batch.interactions.length,
  };
}

// ---------------------------------------------------------------------------
// --list
// ---------------------------------------------------------------------------
function runList(batchesById) {
  const summaries = [...batchesById.values()].map(summarizeBatch).sort((a, b) => {
    const da = a.date ? a.date.getTime() : 0;
    const dbb = b.date ? b.date.getTime() : 0;
    return da - dbb;
  });

  console.log(`Lotes de importação em "${TENANT}": ${summaries.length}\n`);
  if (!summaries.length) {
    console.log('Nenhum lote de importação encontrado (nenhum doc com importBatchId nesta academia).');
    return;
  }

  for (const s of summaries) {
    console.log(
      `${shortId(s.id)} · ${formatDate(s.date)} · ${s.source} · leads: ${s.leadsTouched} (${s.leadsCreated} novos) · ` +
      `contratos: ${s.contracts} · interações: ${s.interactions}`
    );
  }

  const total = summaries.reduce((acc, s) => ({
    leadsTouched: acc.leadsTouched + s.leadsTouched,
    leadsCreated: acc.leadsCreated + s.leadsCreated,
    contracts: acc.contracts + s.contracts,
    interactions: acc.interactions + s.interactions,
  }), { leadsTouched: 0, leadsCreated: 0, contracts: 0, interactions: 0 });

  console.log(
    `\nTotal: ${summaries.length} lote(s) · ${total.leadsTouched} leads tocados (${total.leadsCreated} novos) · ` +
    `${total.contracts} contratos · ${total.interactions} interações.`
  );
}

// Aceita o id completo ou um prefixo (mesma convenção do shortId: 8
// caracteres, sem diferenciar maiúscula/minúscula). "last" pega o lote com a
// maior batchDate entre todos.
function resolveBatch(batchesById, arg) {
  if (arg === 'last') {
    let best = null;
    let bestDate = null;
    for (const batch of batchesById.values()) {
      const d = batchDate(batch);
      if (!best || (d && (!bestDate || d > bestDate))) { best = batch; bestDate = d; }
    }
    return best;
  }
  if (batchesById.has(arg)) return batchesById.get(arg);
  const needle = String(arg).toUpperCase();
  const matches = [...batchesById.values()].filter((b) => b.id.toUpperCase().startsWith(needle));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error(`"${arg}" é ambíguo: casa com ${matches.length} lotes. Use o id completo.`);
    process.exit(1);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Duplicatas: agrupa TODOS os leads do tenant por CPF, telefone e nome
// normalizado. Só interessa um grupo se tiver 2+ docs e pelo menos um deles
// for do lote inspecionado.
// ---------------------------------------------------------------------------
function findDuplicateGroups(allLeads, batchId) {
  const byCpf = new Map();
  const byPhone = new Map();
  const byName = new Map();
  for (const lead of allLeads) {
    if (lead.cpfDigits) {
      if (!byCpf.has(lead.cpfDigits)) byCpf.set(lead.cpfDigits, []);
      byCpf.get(lead.cpfDigits).push(lead);
    }
    if (lead.whatsappDigits) {
      if (!byPhone.has(lead.whatsappDigits)) byPhone.set(lead.whatsappDigits, []);
      byPhone.get(lead.whatsappDigits).push(lead);
    }
    const nameKey = normalizeName(lead.name);
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(lead);
    }
  }
  const groups = [];
  const collect = (map, type) => {
    for (const [key, docs] of map) {
      if (docs.length < 2) continue;
      if (!docs.some((d) => d.importBatchId === batchId)) continue;
      groups.push({ type, key, docs });
    }
  };
  collect(byCpf, 'cpf');
  collect(byPhone, 'telefone');
  collect(byName, 'nome');
  return groups;
}

// Por que a importação não achou o cadastro pré-existente (comparando o doc
// do lote contra o doc de fora do lote no mesmo grupo de duplicata).
function explainMismatch(batchDoc, otherDoc) {
  if (!batchDoc || !otherDoc) return 'não consegui explicar: confira os dois cadastros';
  const oldHasCpf = Boolean(otherDoc.cpfDigits);
  const oldHasPhone = Boolean(otherDoc.whatsappDigits);
  const newHasCpf = Boolean(batchDoc.cpfDigits);
  const newHasPhone = Boolean(batchDoc.whatsappDigits);

  if (!oldHasCpf && !oldHasPhone) {
    return 'o cadastro antigo não tem cpfDigits nem whatsappDigits (backfill de escala não passou por ele)';
  }
  if (newHasPhone && oldHasPhone && batchDoc.whatsappDigits !== otherDoc.whatsappDigits) {
    return `os dígitos do telefone diferem (base: ${otherDoc.whatsappDigits}, planilha: ${batchDoc.whatsappDigits})`;
  }
  if (newHasCpf !== oldHasCpf) {
    return 'o CPF só existe de um lado';
  }
  return 'não consegui explicar: confira os dois cadastros';
}

// Uma "pessoa" duplicada = um cluster de docs conectados por pelo menos um
// tipo de coincidência (CPF, telefone ou nome). Sem isto o mesmo par contado
// em dois tipos de coincidência (ex.: mesmo CPF e também mesmo nome) infla a
// contagem de pessoas. Union-find simples sobre os ids dos docs.
function clusterDuplicates(groups) {
  const parent = new Map();
  const find = (x) => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(x) !== root) {
      const next = parent.get(x);
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const g of groups) {
    for (const d of g.docs) if (!parent.has(d.id)) parent.set(d.id, d.id);
  }
  for (const g of groups) {
    const [first, ...rest] = g.docs;
    for (const d of rest) union(first.id, d.id);
  }
  const clusters = new Map();
  for (const id of parent.keys()) {
    const root = find(id);
    if (!clusters.has(root)) clusters.set(root, new Set());
    clusters.get(root).add(id);
  }
  return [...clusters.values()].filter((c) => c.size >= 2);
}

// ---------------------------------------------------------------------------
// --inspect
// ---------------------------------------------------------------------------
function runInspect(batch, allLeads) {
  const s = summarizeBatch(batch);
  const contracts = batch.contracts;

  console.log(`Lote ${shortId(batch.id)} (id completo: ${batch.id}) · tenant "${TENANT}"\n`);

  console.log('1. Resumo');
  console.log(`   Data: ${formatDate(s.date)}`);
  console.log(`   Origem: ${s.source}`);
  console.log(`   Importado por: ${s.importedBy}`);
  console.log(`   Leads tocados: ${s.leadsTouched} (criados: ${s.leadsCreated}, já existiam/promovidos: ${s.leadsPromoted})`);
  console.log(`   Contratos: ${s.contracts}`);
  console.log(`   Interações: ${s.interactions}`);

  console.log('\n2. Contratos');
  if (!contracts.length) {
    console.log('   Nenhum contrato foi criado neste lote.');
  } else {
    const comPlano = contracts.filter((c) => c.planId).length;
    const semPlano = contracts.length - comPlano;
    const comValor = contracts.filter((c) => Number(c.value) > 0).length;
    const semValor = contracts.length - comValor;
    const inferido = contracts.filter((c) => c.startsAtInferred === true).length;
    console.log(`   Com plano do catálogo (planId): ${comPlano}`);
    console.log(`   Sem plano do catálogo (planId nulo): ${semPlano}`);
    console.log(`   Com valor (value > 0): ${comValor}`);
    console.log(`   Sem valor (value = 0): ${semValor}`);
    console.log(`   Com início de vigência inferido (startsAtInferred): ${inferido}`);
    if (semPlano) {
      const porNome = new Map();
      for (const c of contracts) {
        if (c.planId) continue;
        const nome = c.planName || '(sem nome de plano na planilha)';
        porNome.set(nome, (porNome.get(nome) || 0) + 1);
      }
      console.log('   Nomes de plano da planilha sem correspondência no catálogo (o "sem contrato selecionado"):');
      for (const [nome, count] of [...porNome.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`     "${nome}": ${count}`);
      }
    }
  }

  console.log('\n3. Clientes sem vigência');
  const semVigencia = batch.leads.filter((l) => (l.lifecycleStage === 'cliente' || l.isConverted) && !l.currentContractEndsAt);
  console.log(`   ${semVigencia.length} lead(s) viraram cliente neste lote sem data de fim de contrato registrada.`);
  if (semVigencia.length) {
    for (const l of semVigencia.slice(0, 10)) console.log(`     - ${l.name || '(sem nome)'}`);
    if (semVigencia.length > 10) console.log(`     ... e mais ${semVigencia.length - 10}.`);
  }
  console.log('   Esses clientes não aparecem nos funis de Renovações nem de Vencidos até alguém registrar um contrato pra eles.');

  console.log('\n4. Duplicatas na base');
  const groups = findDuplicateGroups(allLeads, batch.id);
  if (!groups.length) {
    console.log('   Nenhuma duplicata (por CPF, telefone ou nome) encontrada envolvendo leads deste lote.');
  } else {
    for (const g of groups) {
      const valor = g.type === 'cpf' ? maskCPF(g.key) : g.type === 'telefone' ? maskPhone(g.key) : g.key;
      console.log(`   [${g.type}] ${valor}`);
      for (const doc of g.docs) {
        const fromBatch = doc.importBatchId === batch.id;
        const tokensOk = Boolean(doc.nameTokens && doc.nameTokens.length);
        console.log(
          `     - ${shortId(doc.id)} ${doc.name || '(sem nome)'} · fonte="${doc.source || '(sem origem)'}" · ` +
          `desta importação: ${fromBatch ? 'sim' : 'não'} · cpf:${doc.cpfDigits ? 'sim' : 'não'} tel:${doc.whatsappDigits ? 'sim' : 'não'} tokens:${tokensOk ? 'sim' : 'não'}`
        );
      }
      const batchDoc = g.docs.find((d) => d.importBatchId === batch.id) || null;
      const otherDoc = g.docs.find((d) => d.importBatchId !== batch.id) || null;
      console.log(`     Motivo provável: ${explainMismatch(batchDoc, otherDoc)}`);
    }
  }

  console.log('\n5. Diagnóstico');
  let anyVerdict = false;
  if (contracts.length === 0 && semVigencia.length > 0) {
    anyVerdict = true;
    console.log('   A planilha não tinha coluna de fim de vigência: por isso ninguém ganhou contrato.');
    console.log('   Pra corrigir, faça uma segunda importação mapeando a coluna do relatório de contratos pra "Fim da vigência".');
  }
  if (contracts.length > 0) {
    const semPlanoCount = contracts.filter((c) => !c.planId).length;
    if (semPlanoCount > contracts.length / 2) {
      anyVerdict = true;
      const nomes = [...new Set(contracts.filter((c) => !c.planId).map((c) => c.planName || '(sem nome de plano na planilha)'))];
      console.log(`   A maioria dos contratos (${semPlanoCount} de ${contracts.length}) não achou o plano no catálogo. Nomes que vieram na planilha: ${nomes.join(', ')}.`);
    }
  }
  if (groups.length) {
    anyVerdict = true;
    const pessoas = clusterDuplicates(groups).length;
    console.log(`   ${pessoas} pessoa(s) aparecem mais de uma vez na base.`);
  }
  if (!anyVerdict) {
    console.log('   Nada fora do esperado encontrado neste lote.');
  }
}

// ---------------------------------------------------------------------------
// --undo
// ---------------------------------------------------------------------------
async function runUndo(batch) {
  const created = batch.leads.filter(isCreatedByImport);
  const promoted = batch.leads.filter((l) => !isCreatedByImport(l));

  console.log(
    `Desfazer lote ${shortId(batch.id)} (id completo: ${batch.id}) do tenant "${TENANT}" ` +
    `${APPLY ? '[APLICANDO]' : '[SIMULAÇÃO]'}\n`
  );
  console.log('Plano:');
  console.log(`   Interações a apagar: ${batch.interactions.length}`);
  console.log(`   Contratos a apagar: ${batch.contracts.length}`);
  console.log(`   Leads criados pela importação a apagar: ${created.length}`);
  console.log(
    `   Leads que já existiam antes (promovidos/atualizados): ${promoted.length}` +
    (INCLUDE_PROMOVIDOS ? ' (carimbos de importação e resumo de contrato serão limpos)' : ' (não serão tocados)')
  );
  for (const l of promoted) console.log(`     - ${shortId(l.id)} ${l.name || '(sem nome)'}`);
  if (promoted.length && !INCLUDE_PROMOVIDOS) {
    console.log('   O estado de cliente desses leads não é revertido: o estágio anterior à importação não é conhecido.');
    console.log('   Rode de novo com --include-promovidos pra ao menos limpar os carimbos de importação e o resumo de contrato.');
  }
  if (promoted.length && INCLUDE_PROMOVIDOS) {
    console.log('   status, lifecycleStage e lifecycleBucket desses leads ficam como estão: só os carimbos de importação e o resumo de contrato são removidos.');
  }

  if (!APPLY) {
    console.log('\nSIMULAÇÃO: nada foi gravado. Repita com --apply pra executar de verdade.');
    return;
  }

  const ops = [];
  for (const i of batch.interactions) ops.push({ type: 'delete', ref: i.ref });
  for (const c of batch.contracts) ops.push({ type: 'delete', ref: c.ref });
  for (const l of created) ops.push({ type: 'delete', ref: l.ref });
  if (INCLUDE_PROMOVIDOS) {
    for (const l of promoted) {
      ops.push({
        type: 'update',
        ref: l.ref,
        data: {
          currentContractId: admin.firestore.FieldValue.delete(),
          currentPlanName: admin.firestore.FieldValue.delete(),
          currentContractValue: admin.firestore.FieldValue.delete(),
          currentContractStartsAt: admin.firestore.FieldValue.delete(),
          currentContractEndsAt: admin.firestore.FieldValue.delete(),
          currentContractStatus: admin.firestore.FieldValue.delete(),
          importBatchId: admin.firestore.FieldValue.delete(),
          importedBy: admin.firestore.FieldValue.delete(),
          importSource: admin.firestore.FieldValue.delete(),
          importedAt: admin.firestore.FieldValue.delete(),
        },
      });
    }
  }

  console.log(`\nGravando ${ops.length} operação(ões) em lotes de até 400...`);
  let writeBatch = db.batch();
  let pending = 0;
  let executed = 0;
  const flush = async () => {
    if (pending === 0) return;
    await writeBatch.commit();
    console.log(`   ...${executed} de ${ops.length} gravadas`);
    writeBatch = db.batch();
    pending = 0;
  };
  for (const op of ops) {
    if (op.type === 'delete') writeBatch.delete(op.ref);
    else writeBatch.update(op.ref, op.data);
    pending++;
    executed++;
    if (pending >= 400) await flush();
  }
  await flush();

  console.log(
    `\nConcluído: ${batch.interactions.length} interações apagadas, ${batch.contracts.length} contratos apagados, ` +
    `${created.length} leads apagados` +
    (INCLUDE_PROMOVIDOS ? `, ${promoted.length} leads promovidos limpos` : '') + '.'
  );
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------
async function main() {
  const { leads, contracts, interactions } = await loadAll();
  const batchesById = groupByBatch({ leads, contracts, interactions });

  if (MODE === 'list') {
    runList(batchesById);
    return;
  }

  const batch = resolveBatch(batchesById, BATCH_ARG);
  if (!batch) {
    console.error(`Lote "${BATCH_ARG}" não encontrado no tenant "${TENANT}". Rode --list pra ver os lotes existentes.`);
    process.exit(1);
  }

  if (MODE === 'inspect') {
    runInspect(batch, leads);
  } else {
    await runUndo(batch);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
