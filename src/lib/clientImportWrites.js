// Gravação da importação de clientes no Firestore. O QUE gravar vem de
// clientImport.js (puro); aqui fica o COMO: as consultas em lote que casam a
// planilha com a base e os batches que gravam lead + contrato + evento.
//
// Sem função na Vercel: a sessão assumida é o uid do admin da academia
// (api/impersonate.js), então a criação de lead passa pelo isAdmin das regras
// e a de contrato/interação é aberta a qualquer membro. Nenhuma regra muda.

import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { appId, LEADS_PATH, CONTRACTS_PATH, INTERACTIONS_PATH } from './firebase.js';
import { normalizeLeadDoc } from './leads.js';
import { normalizeName } from './clientImport.js';

// Limite do operador `in` (e do array-contains-any) do Firestore.
const IN_LIMIT = 30;
// Teto de operações por batch (o Firestore aceita 500; margem para o carimbo).
const OPS_PER_BATCH = 450;

const leadsCol = (db) => collection(db, 'artifacts', appId, 'public', 'data', LEADS_PATH);

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// Uma consulta de igualdade por lote de até 30 valores num campo materializado
// (cpfDigits, whatsappDigits): índice automático, sem composto.
const queryIn = async (db, field, values) => {
  const uniq = [...new Set((values || []).filter(Boolean))];
  const found = [];
  for (const part of chunk(uniq, IN_LIMIT)) {
    const snap = await getDocs(query(leadsCol(db), where(field, 'in', part)));
    snap.docs.forEach((d) => found.push(normalizeLeadDoc(d)));
  }
  return found;
};

// Índice da base para resolveMatch (clientImport.js): CPF e telefone por
// igualdade em duas passadas; nome só para quem não casou por nenhum dos dois
// (é o único uso do nome, que nunca casa sozinho). O nome NÃO consulta
// nameLower por igualdade: o cadastro grava nameLower sem colapsar espaços,
// então "Ana  Silva" digitada com dois espaços nunca casaria com a planilha.
// Consulta nameTokens (array de palavras, sem espaço) pelo primeiro token e
// recompõe a chave a partir do `name` gravado com a mesma normalizeName da
// planilha. Dedupe por id: um doc pode voltar em mais de um lote.
export async function lookupExisting({ db, candidates }) {
  const byCpf = new Map();
  const byPhone = new Map();
  const byName = new Map();
  (await queryIn(db, 'cpfDigits', candidates.map((c) => c.cpfDigits))).forEach((l) => {
    if (l.cpfDigits && !byCpf.has(l.cpfDigits)) byCpf.set(l.cpfDigits, l);
  });
  (await queryIn(db, 'whatsappDigits', candidates.map((c) => c.whatsappDigits))).forEach((l) => {
    if (l.whatsappDigits && !byPhone.has(l.whatsappDigits)) byPhone.set(l.whatsappDigits, l);
  });
  const unmatched = candidates.filter((c) =>
    !(c.cpfDigits && byCpf.has(c.cpfDigits)) && !(c.whatsappDigits && byPhone.has(c.whatsappDigits)));
  const wanted = new Set(unmatched.map((c) => c.nameLower).filter(Boolean));
  const firstTokens = [...new Set(unmatched.map((c) => c.nameLower.split(' ')[0]).filter(Boolean))];
  for (const part of chunk(firstTokens, IN_LIMIT)) {
    const snap = await getDocs(query(leadsCol(db), where('nameTokens', 'array-contains-any', part)));
    snap.docs.forEach((d) => {
      const l = normalizeLeadDoc(d);
      const key = normalizeName(l.name);
      if (!wanted.has(key)) return;
      const list = byName.get(key) || [];
      if (!list.some((x) => x.id === l.id)) list.push(l);
      byName.set(key, list);
    });
  }
  return { byCpf, byPhone, byName };
}

// Grava os itens preparados por buildImportedClientWrites. Cada linha fica
// inteira num só batch (lead, contrato e evento nascem juntos ou não nascem).
// Falhou um batch (na montagem ou no commit): devolve quantas linhas entraram
// e de qual linha em diante faltou; a recuperação é rodar o mesmo arquivo de
// novo (idempotente).
export async function runImport({ db, appUser, items, importMeta, onProgress }) {
  const groups = [];
  let cur = [];
  let curOps = 0;
  for (const it of items) {
    const ops = it.contract ? 3 : 2;
    if (curOps + ops > OPS_PER_BATCH) { groups.push(cur); cur = []; curOps = 0; }
    cur.push(it);
    curOps += ops;
  }
  if (cur.length) groups.push(cur);

  let done = 0;
  for (const group of groups) {
    try {
      const batch = writeBatch(db);
      for (const it of group) {
        const leadRef = it.leadId ? doc(leadsCol(db), it.leadId) : doc(leadsCol(db));
        const leadData = { ...it.leadData, importedAt: serverTimestamp() };
        if (it.contract) {
          const contractRef = doc(collection(db, 'artifacts', appId, 'public', 'data', CONTRACTS_PATH));
          batch.set(contractRef, {
            ...it.contract,
            leadId: leadRef.id,
            createdAt: serverTimestamp(),
            importedAt: serverTimestamp()
          });
          leadData.currentContractId = contractRef.id;
        }
        batch.set(leadRef, leadData, { merge: true });
        // Evento de sistema: sem bump de lastInteractionAt/interactionsCount:
        // importação não é contato (ver hasActiveInteractionToday).
        batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH)), {
          leadId: leadRef.id,
          leadName: it.leadName || null,
          consultantName: appUser?.name || null,
          leadConsultantId: it.owner?.consultantId ?? null,
          leadConsultantAuthUid: it.owner?.consultantAuthUid ?? null,
          actorId: appUser?.id || null,
          actorAuthUid: appUser?.authUid || null,
          text: it.interactionText,
          type: 'import',
          importedBy: importMeta.importedBy,
          importSource: importMeta.importSource,
          importBatchId: importMeta.importBatchId,
          importedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
      await batch.commit();
    } catch (error) {
      return { done, failedFromRow: group[0].rowNumber, error };
    }
    done += group.length;
    if (onProgress) onProgress(done, items.length);
  }
  return { done, failedFromRow: null, error: null };
}
