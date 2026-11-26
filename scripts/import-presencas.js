// Importa o relatório de Presenças da Next Fit (aula de funcional) para a
// aderência do perfil do professor (spec 2026-11-24-perfil-do-professor e
// plano docs/superpowers/plans/2026-11-25-perfil-do-professor-06-aderencia.md).
//
// Soma as presenças de cada aluno por semana (segunda a sexta), casa pelo CPF
// (cpfDigits do lead) e grava stronix_presencas/{leadId}_{segunda}:
// { leadId, semana, presencas, fonte, arquivo, importadoEm }. Regravar a mesma
// semana troca o número, e o aluno que não tem mais presença numa semana
// importada perde o registro antigo (só nas semanas que receberam algum
// registro agora). Só entram as semanas inteiras de --de a --ate, o período do
// relatório, para um relatório que corta a semana não gravar uma contagem
// pela metade.
//
// O relatório "Presenças por contrato" não traz o CPF. Ele vem da lista de
// clientes da Next Fit (--clientes=<exportação com as colunas Nome e CPF>), pelo
// nome exatamente como está cadastrado lá. Nome repetido com dois CPFs vai para
// as pendências.
//
// SEM --apply NÃO GRAVA NADA: mostra o que gravaria. A saída só traz
// contagens. A lista de pendências (linha sem CPF, CPF sem lead, CPF com mais
// de um cadastro), com nome e CPF para a recepção acertar, só sai num arquivo,
// com --pendencias=<caminho>, e esse arquivo nunca entra no repositório.
//
// Uso (mesmas credenciais Admin das funções api/):
//   node --env-file=.env.local scripts/import-presencas.js <relatorio.xlsx|csv> \
//     --tenant=stronix-crm-app --de=2026-11-01 --ate=2026-11-30 \
//     --clientes=<clientes.xlsx> [--pendencias=/caminho/pendencias.csv] [--apply]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import { casarComLeads, colunasDoRelatorio, cpfPorNome, idsQueSobram, nomePorCpf, presencasDoRelatorio } from '../src/lib/professor/presencas.js';

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith('--'));
const opt = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split('=').slice(1).join('=') ?? null;
const aplicar = args.includes('--apply');
const tenant = opt('tenant');
const de = opt('de');
const ate = opt('ate');
const pendencias = opt('pendencias');
const clientes = opt('clientes');
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

if (!arquivo || !tenant || !DIA_RE.test(de || '') || !DIA_RE.test(ate || '')) {
  console.error('Uso: node --env-file=.env.local scripts/import-presencas.js <relatorio> --tenant=<id> --de=AAAA-MM-DD --ate=AAAA-MM-DD [--pendencias=<arquivo>] [--apply]');
  process.exit(1);
}

const lerPlanilha = (f) => {
  const livro = XLSX.read(readFileSync(f), { cellDates: true });
  return XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { defval: '' });
};
const linhas = lerPlanilha(arquivo);
const cabecalho = linhas.length ? Object.keys(linhas[0]) : [];
const colunas = colunasDoRelatorio(cabecalho);
if (!colunas.data || (!colunas.cpf && !colunas.nome)) {
  console.error(`Não achei a coluna de ${!colunas.data ? 'data' : 'CPF nem a de nome'} no relatório. Colunas: ${cabecalho.join(' | ')}`);
  console.error('Acrescente o nome em APELIDOS, em src/lib/professor/presencas.js.');
  process.exit(1);
}
console.log('Colunas usadas:', colunas);
if (!colunas.cpf && !clientes) {
  console.error('O relatório não tem CPF: passe a lista de clientes da Next Fit com --clientes=<arquivo> (colunas Nome e CPF).');
  process.exit(1);
}
const porNome = colunas.cpf ? null : cpfPorNome(lerPlanilha(clientes));
if (porNome) console.log(`Lista de clientes: ${porNome.size} nomes com CPF.`);

const { contagem, resumo, semCpf, semanas } = presencasDoRelatorio(linhas, colunas, { de, ate, cpfPorNome: porNome });
console.log('Semanas inteiras no período:', semanas.join(', ') || 'nenhuma');
console.log('Linhas do relatório:', resumo);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const col = (n) => db.collection('artifacts').doc(tenant).collection('public').doc('data').collection(n);

const cpfs = [...new Set([...contagem.keys()].map((k) => k.split('_')[0]))];
const leads = [];
for (let i = 0; i < cpfs.length; i += 30) {
  const snap = await col('stronix_leads').where('cpfDigits', 'in', cpfs.slice(i, i + 30)).get();
  snap.docs.forEach((d) => leads.push({ id: d.id, ...d.data() }));
}
const { registros, semLead, duplicados } = casarComLeads(contagem, leads);
const alunos = new Set(registros.map((r) => r.leadId)).size;
console.log(`Casados: ${registros.length} registros de ${alunos} alunos. CPF sem cadastro no Stronilead: ${semLead.length}. CPF com mais de um cadastro: ${duplicados.length}. Presenças sem CPF: ${semCpf.length} (${new Set(semCpf.map((l) => String(l[colunas.nome] ?? ''))).size} pessoas).`);

// O que sobrou de uma importação anterior nas semanas que receberam registro.
const existentes = [];
const semanasComRegistro = [...new Set(registros.map((r) => r.semana))];
for (let i = 0; i < semanasComRegistro.length; i += 30) {
  const snap = await col('stronix_presencas').where('semana', 'in', semanasComRegistro.slice(i, i + 30)).get();
  snap.docs.forEach((d) => existentes.push(d.id));
}
const sobram = idsQueSobram(existentes, registros);
console.log(`Registros de uma importação anterior sem presença agora (saem com --apply): ${sobram.length}.`);

if (pendencias) {
  const nome = (l) => String(l[colunas.nome] ?? '').replace(/[;\n]/g, ' ');
  const porCpf = nomePorCpf(linhas, colunas, porNome);
  const limpo = (v) => String(v ?? '').replace(/[;\n]/g, ' ');
  const saida = ['motivo;nome;cpf'];
  semLead.forEach((c) => saida.push(`CPF sem cadastro no Stronilead;${limpo(porCpf.get(c))};${c}`));
  duplicados.forEach((c) => saida.push(`CPF em mais de um cadastro;${limpo(porCpf.get(c))};${c}`));
  const motivoSemCpf = porNome ? 'Nome sem CPF na lista de clientes da Next Fit (ou repetido)' : 'Linha sem CPF';
  [...new Set(semCpf.map(nome))].forEach((n) => saida.push(`${motivoSemCpf};${n};`));
  writeFileSync(pendencias, `${saida.join('\n')}\n`);
  console.log(`Pendências gravadas em ${pendencias} (${saida.length - 1} linhas).`);
}

if (!aplicar) {
  console.log('Simulação: nada foi gravado. Rode de novo com --apply para gravar.');
  process.exit(0);
}

const agora = admin.firestore.FieldValue.serverTimestamp();
for (let i = 0; i < sobram.length; i += 400) {
  const lote = db.batch();
  sobram.slice(i, i + 400).forEach((id) => lote.delete(col('stronix_presencas').doc(id)));
  await lote.commit();
}
for (let i = 0; i < registros.length; i += 400) {
  const lote = db.batch();
  registros.slice(i, i + 400).forEach((r) => {
    lote.set(col('stronix_presencas').doc(`${r.leadId}_${r.semana}`), { ...r, fonte: 'nextfit', arquivo: basename(arquivo), importadoEm: agora });
  });
  await lote.commit();
}
console.log(`Gravados: ${registros.length} registros em stronix_presencas. Apagados: ${sobram.length}.`);
process.exit(0);
