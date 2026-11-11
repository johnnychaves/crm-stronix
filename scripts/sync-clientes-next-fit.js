// Acerto da base de clientes do Stronilead com a Next Fit.
//
// Lê duas exportações da Next Fit (lista de clientes e relatório de contratos
// a vencer), compara com os leads de UMA academia e gera um relatório. Só grava
// com --apply --etapa=N, depois do OK do Johnny sobre o relatório.
//   Etapa 1: completa CPF e nascimento vazios de quem já é cliente.
//   Etapa 2: cria as matrículas que faltam (contrato e, se preciso, cadastro),
//            marcadas como importadas para não entrarem como venda nos painéis.
// As regras moram em src/lib/nextFitSync.js, com teste.
// Spec: docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md
//
// Uso (a credencial de administrador vem do .env.local do checkout principal):
//   node --env-file=/Users/johnnybittencourt/STRONIX-FIRMA/06-sistemas/stronilead/.env.local \
//     scripts/sync-clientes-next-fit.js <tenantId> \
//     --clientes=<lista.xlsx> --contratos=<relatorio.xlsx> \
//     [--planos=<plano-next-fit.json>] [--etapa=1|2 --apply]
//
//   - Sem --apply: DRY-RUN. Lê e escreve só o relatório. (padrão)
//   - --apply exige --etapa. A etapa 2 exige --planos sem pendência.
//   - tenantId: obrigatório, sem padrão (a STRONIX é stronix-crm-app).
//
// O relatório, o esqueleto da tabela de planos e a cópia de segurança saem em
// ~/Backups/next-fit-sync/<tenant>-<data>/, fora do repositório, porque levam
// nome e telefone de pessoas. O console mostra só contagens.

import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import { toCsv } from '../src/lib/csvExport.js';
import { pickDefaultFunnel } from '../api/_referral.js';
import { distinctPlanNames, normalizeName } from '../src/lib/clientImport.js';
import {
  NF_ACTIVE, GROUPS, parsePeople, parseContracts, attachContracts, matchPeopleToLeads,
  planEtapa1, planEtapa2, buildEtapa2Items, extrasInStronilead, findUndefined
} from '../src/lib/nextFitSync.js';

// Datas das planilhas são dias do calendário das academias.
process.env.TZ = 'America/Sao_Paulo';

const USO = 'Uso: node --env-file=<.env.local> scripts/sync-clientes-next-fit.js <tenantId> --clientes=<xlsx> --contratos=<xlsx> [--planos=<json>] [--etapa=1|2 --apply]';
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = args.includes('--apply');
const ETAPA = flag('etapa');
const TENANT = args.find((a) => !a.startsWith('--'));
const CLIENTES = flag('clientes');
const CONTRATOS = flag('contratos');
const PLANOS = flag('planos');

const desconhecidas = args.filter((a) => a.startsWith('--') && a !== '--apply' && !/^--(clientes|contratos|planos|etapa)=/.test(a));
if (desconhecidas.length) {
  console.error(`Opção desconhecida: ${desconhecidas.join(', ')}\n${USO}`);
  process.exit(1);
}
if (!TENANT || !CLIENTES || !CONTRATOS) {
  console.error(`${USO}\nO tenant é obrigatório. Não existe padrão: errar o alvo aqui varre a academia errada.`);
  process.exit(1);
}
if (APPLY && !['1', '2'].includes(ETAPA)) {
  console.error('--apply exige --etapa=1 ou --etapa=2.');
  process.exit(1);
}
if (ETAPA && !['1', '2'].includes(ETAPA)) {
  console.error('--etapa só aceita 1 ou 2.');
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('Faltam env vars: FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const db = admin.firestore();

const LEADS = 'stronix_leads';
const CONTRACTS = 'stronix_contratos';
const INTERACTIONS = 'stronix_interactions';
const col = (name) => db.collection('artifacts').doc(TENANT).collection('public').doc('data').collection(name);
const readAll = async (name) => (await col(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

// Datas das planilhas chegam como número serial do Excel (sem cellDates): o
// parseImportDate converte sem erro de fuso.
const readSheet = (file) => {
  const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
};

const fmt = (d) => (d ? d.toLocaleDateString('pt-BR') : '');

async function run() {
  // Tenant inexistente varre um caminho vazio e conclui "0 a gravar" como se
  // tivesse dado certo (já aconteceu no backfill-zap-match-key.js).
  if (!(await db.collection('tenants').doc(TENANT).get()).exists) {
    console.error(`Tenant "${TENANT}" não existe na coleção 'tenants'.`);
    process.exit(1);
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const outDir = path.join(os.homedir(), 'Backups', 'next-fit-sync', `${TENANT}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });

  // --- leitura -------------------------------------------------------------
  const leadsSnap = await col(LEADS).get();
  const leads = leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lidoEm = new Map(leadsSnap.docs.map((d) => [d.id, d.updateTime]));
  const [planos, usersList, professores, funnels] = await Promise.all([
    readAll('stronix_planos'), readAll('stronix_users'), readAll('stronix_professores'), readAll('stronix_funnels')
  ]);
  const planMap = PLANOS ? JSON.parse(fs.readFileSync(PLANOS, 'utf8')) : {};

  // --- cálculo -------------------------------------------------------------
  const allPeople = parsePeople(readSheet(CLIENTES), now);
  const { people, orphans, onInactive } = attachContracts(allPeople, parseContracts(readSheet(CONTRATOS), now));
  const active = people.filter((p) => NF_ACTIVE.has(p.nf));
  const matched = matchPeopleToLeads(active, leads);
  const e1 = planEtapa1(matched);
  const e2 = planEtapa2(matched, now);
  const importMeta = {
    importedBy: 'script:sync-clientes-next-fit',
    importSource: 'nextfit',
    importBatchId: `nextfit-${stamp}`,
    now
  };
  const funnelId = pickDefaultFunnel(funnels)?.id ?? null;
  const built = buildEtapa2Items(e2.groups, { usersList, professores, planos, planMap, funnelId, importMeta, now });
  const extras = extrasInStronilead(matched, leads, now);

  const problemas = built.items
    .map((it) => findUndefined(it.leadData) || findUndefined(it.contract))
    .filter(Boolean);
  if (problemas.length) {
    console.error(`Gravação com campo undefined (${problemas[0]}). Nada será gravado até corrigir.`);
    process.exit(1);
  }

  // --- relatório (arquivos com nome e telefone, fora do repositório) -------
  // A mesma pessoa aparece nas duas etapas: conta uma vez só.
  const unicas = (...listas) => [...new Map(listas.flat().map((m) => [m.person.rowNumber, m])).values()];
  const ambiguos = unicas(e1.ambiguous, e2.ambiguous);
  const conflitos = unicas(e1.conflicts, e2.conflicts);
  const sheets = {
    'etapa1-a-gravar': [
      ['nome', 'preenche', 'lead'],
      e1.writes.map((w) => ({ nome: w.m.person.name, preenche: w.fills.join(' e '), lead: w.leadId }))
    ],
    'cpf-divergente': [
      ['nome', 'lead'],
      conflitos.map((m) => ({ nome: m.person.name, lead: m.item.id }))
    ],
    ambiguos: [
      ['nome', 'candidatos'],
      ambiguos.map((m) => ({ nome: m.person.name, candidatos: m.candidates.map((c) => c.id).join(' ') }))
    ],
    'etapa2-a-criar': [
      ['grupo', 'nome', 'plano', 'inicio', 'fim', 'consultor'],
      built.items.map((it) => ({
        grupo: it.group, nome: it.leadName, plano: it.contract.planName,
        inicio: fmt(it.contract.startsAt), fim: fmt(it.contract.endsAt), consultor: it.owner.consultantName || 'sem dono'
      }))
    ],
    'sem-contrato-no-relatorio': [
      ['nome', 'situacao'],
      e2.semContrato.map((m) => ({ nome: m.person.name, situacao: m.person.nf }))
    ],
    'contrato-invalido': [
      ['nome', 'inicio', 'fim'],
      e2.contratoInvalido.map((m) => ({ nome: m.person.name, inicio: fmt(m.person.contract.startsAt), fim: fmt(m.person.contract.endsAt) }))
    ],
    'contrato-vigente-em-cliente-inativo': [
      ['nome', 'situacao', 'plano', 'fim'],
      onInactive.map((p) => ({ nome: p.name, situacao: p.nf, plano: p.contract.description, fim: fmt(p.contract.endsAt) }))
    ],
    'contrato-sem-pessoa': [
      ['nome', 'plano', 'fim'],
      orphans.map((o) => ({ nome: o.contract.name, plano: o.contract.description, fim: fmt(o.contract.endsAt) }))
    ],
    'clientes-a-mais-no-stronilead': [
      ['nome', 'lead'],
      extras.map((l) => ({ nome: l.name, lead: l.id }))
    ]
  };
  for (const [file, [labels, rows]] of Object.entries(sheets)) {
    const columns = labels.map((label) => ({ key: label, label }));
    fs.writeFileSync(path.join(outDir, `${file}.csv`), `\uFEFF${toCsv(rows, columns)}`, { mode: 0o600 });
  }

  // Tabela de planos: esqueleto com o que o nome já resolve sozinho.
  const descricoes = distinctPlanNames(active.filter((p) => p.contract).map((p) => ({ planName: p.contract.description })));
  const esqueleto = Object.fromEntries(descricoes.map((d) => [
    d.key, planMap[d.key] ?? planos.find((p) => normalizeName(p.name) === d.key)?.id ?? null
  ]));
  fs.writeFileSync(path.join(outDir, 'plano-next-fit.json'), `${JSON.stringify(esqueleto, null, 2)}\n`, { mode: 0o600 });

  // --- resumo (só contagens) ----------------------------------------------
  const g = e2.groups;
  console.log(`\nAcerto com a Next Fit · tenant "${TENANT}" · ${APPLY ? `GRAVAR etapa ${ETAPA}` : 'DRY-RUN'}`);
  console.log(`Next Fit: ${allPeople.length} clientes, ${active.length} ativos ou suspensos. Stronilead: ${leads.length} fichas.`);
  console.log(`Etapa 1: ${e1.writes.length} fichas a completar. CPF divergente: ${conflitos.length}. Ambíguas: ${ambiguos.length}.`);
  console.log(`Etapa 2: ${g[GROUPS.CONTRATO_NAO_ATIVO].length} clientes com contrato não ativo, ${g[GROUPS.SO_LEAD].length} só leads, ${g[GROUPS.SEM_CADASTRO].length} sem cadastro. Já ativos: ${e2.jaAtivos}.`);
  console.log(`  Gravações montadas: ${built.items.length}. Puladas pela tabela: ${built.skipped.length}. Sem contrato no relatório: ${e2.semContrato.length}. Contrato inválido: ${e2.contratoInvalido.length}.`);
  console.log(`Fora do motor: ${extras.length} clientes a mais no Stronilead, ${onInactive.length} contratos vigentes em cliente inativo, ${orphans.length} contratos sem pessoa.`);
  if (built.unmapped.length) {
    console.log(`\nDescrições de contrato sem plano ligado (${built.unmapped.length}). Preencha ${path.join(outDir, 'plano-next-fit.json')} com o id do plano, "__skip__" ou "__text__":`);
    for (const u of built.unmapped) console.log(`  ${u.count}x ${u.label}`);
    console.log('Planos do catálogo:');
    for (const p of planos) console.log(`  ${p.id}  ${p.name}`);
  }
  console.log(`\nRelatório em ${outDir}`);

  if (!APPLY) {
    console.log('DRY-RUN: nada foi gravado. Revise o relatório e rode de novo com --apply --etapa=N para gravar.');
    return;
  }
  await aplicar({ e1, built, leads, lidoEm, outDir, importMeta });
}

// Lote recusado pela precondição (o documento mudou depois da leitura).
class LoteRecusado extends Error {}
const PRECONDICAO_FALHOU = new Set([9, 5]);
const BATCH_UPDATES = 400;
const BATCH_ITEMS = 130; // 3 gravações por item da etapa 2, abaixo do teto de 500

function guardarCopia(outDir, nome, conteudo) {
  const file = path.join(outDir, nome);
  fs.writeFileSync(file, JSON.stringify(conteudo, null, 2), { mode: 0o600 });
  console.log(`Cópia de segurança em ${file}`);
}

async function commitOuRecusa(batch, lote, lotes, feitos) {
  try {
    await batch.commit();
  } catch (err) {
    if (!PRECONDICAO_FALHOU.has(err?.code)) throw err;
    throw new LoteRecusado([
      `O lote ${lote} de ${lotes} foi recusado: uma ficha mudou, ou foi apagada, depois da leitura. Nada desse lote foi gravado.`,
      feitos ? `Os ${feitos} lotes anteriores já estão gravados.` : null,
      'Rode de novo, primeiro sem --apply, para conferir a lista atualizada. Quem já foi acertado não entra de novo.',
      `Detalhe do Firestore: ${err.message}`
    ].filter(Boolean).join('\n'));
  }
}

async function aplicar({ e1, built, leads, lidoEm, outDir, importMeta }) {
  const byId = new Map(leads.map((l) => [l.id, l]));
  // Sem a hora da leitura o script para: precondição vazia tiraria até a
  // exigência de o documento existir.
  const precondicao = (id) => {
    const lastUpdateTime = lidoEm.get(id);
    if (!lastUpdateTime) throw new Error(`Sem a hora da leitura da ficha ${id}. Nada foi gravado.`);
    return { lastUpdateTime };
  };
  const ts = admin.firestore.FieldValue.serverTimestamp();

  if (ETAPA === '1') {
    const antes = Object.fromEntries(e1.writes.map((w) => [
      w.leadId, Object.fromEntries(Object.keys(w.patch).map((k) => [k, byId.get(w.leadId)[k] ?? null]))
    ]));
    guardarCopia(outDir, 'copia-etapa1.json', antes);
    const lotes = Math.ceil(e1.writes.length / BATCH_UPDATES);
    for (let i = 0; i < e1.writes.length; i += BATCH_UPDATES) {
      const batch = db.batch();
      for (const w of e1.writes.slice(i, i + BATCH_UPDATES)) {
        batch.update(col(LEADS).doc(w.leadId), w.patch, precondicao(w.leadId));
      }
      await commitOuRecusa(batch, i / BATCH_UPDATES + 1, lotes, i / BATCH_UPDATES);
    }
    console.log(`Concluído: ${e1.writes.length} fichas completadas.`);
    return;
  }

  if (built.unmapped.length) {
    throw new Error(`Há ${built.unmapped.length} descrição(ões) de contrato sem plano ligado. Preencha a tabela de planos e rode de novo.`);
  }
  const prepared = built.items.map((it) => ({
    it,
    leadRef: it.leadId ? col(LEADS).doc(it.leadId) : col(LEADS).doc(),
    contractRef: col(CONTRACTS).doc()
  }));
  guardarCopia(outDir, 'copia-etapa2.json', {
    lote: importMeta.importBatchId,
    criados: prepared.filter((p) => p.it.isNew).map((p) => ({ lead: p.leadRef.id, contrato: p.contractRef.id })),
    contratosNovosEmFichasExistentes: prepared.filter((p) => !p.it.isNew).map((p) => ({ lead: p.leadRef.id, contrato: p.contractRef.id })),
    antes: Object.fromEntries(prepared.filter((p) => !p.it.isNew).map((p) => [
      p.leadRef.id,
      Object.fromEntries([...Object.keys(p.it.leadData), 'currentContractId'].map((k) => [k, byId.get(p.leadRef.id)[k] ?? null]))
    ]))
  });
  const lotes = Math.ceil(prepared.length / BATCH_ITEMS);
  for (let i = 0; i < prepared.length; i += BATCH_ITEMS) {
    const batch = db.batch();
    for (const { it, leadRef, contractRef } of prepared.slice(i, i + BATCH_ITEMS)) {
      const leadData = { ...it.leadData, importedAt: ts, currentContractId: contractRef.id };
      batch.set(contractRef, { ...it.contract, leadId: leadRef.id, createdAt: ts, importedAt: ts });
      if (it.isNew) batch.create(leadRef, leadData);
      else batch.update(leadRef, leadData, precondicao(it.leadId));
      // Evento de sistema, sem bump de lastInteractionAt: acerto de base não é contato.
      batch.set(col(INTERACTIONS).doc(), {
        leadId: leadRef.id,
        leadName: it.leadName || null,
        consultantName: 'Acerto da base com a Next Fit',
        leadConsultantId: it.owner?.consultantId ?? null,
        leadConsultantAuthUid: it.owner?.consultantAuthUid ?? null,
        actorId: null,
        actorAuthUid: null,
        text: it.interactionText,
        type: 'import',
        importedBy: importMeta.importedBy,
        importSource: importMeta.importSource,
        importBatchId: importMeta.importBatchId,
        importedAt: ts,
        createdAt: ts
      });
    }
    await commitOuRecusa(batch, i / BATCH_ITEMS + 1, lotes, i / BATCH_ITEMS);
  }
  console.log(`Concluído: ${prepared.length} matrículas registradas (${prepared.filter((p) => p.it.isNew).length} cadastros novos).`);
}

run().then(() => process.exit(0)).catch((err) => {
  if (err instanceof LoteRecusado) console.error(`\n${err.message}`);
  else console.error(err);
  process.exit(1);
});
