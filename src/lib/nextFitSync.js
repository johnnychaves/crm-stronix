// Acerto da base de clientes com a Next Fit. Regra pura, sem Firestore e sem
// leitura de arquivo: o scripts/sync-clientes-next-fit.js lê as planilhas e o
// banco e chama estas funções. Reaproveita a regra da importação de clientes
// (clientImport.js), que importa em Node puro.
// Spec: docs/superpowers/specs/2026-11-11-motor-acerto-base-next-fit-design.md

import {
  PLAN_AS_TEXT,
  buildImportedClientWrites,
  enrichCandidate,
  normalizeName,
  normalizePhoneDigits,
  parseImportDate,
  parseRow
} from './clientImport.js';
import { onlyDigits } from './globalSearch.js';
import { isClientLead } from './leads.js';
import { deriveLeadContractStatus } from './contracts.js';
import { formatCPF } from './masks.js';
import { buildLeadSearchFields } from './leadDerived.js';
import { zapMatchKey } from '../../api/_zapPhone.js';

// Campo do parseRow → cabeçalho da lista de clientes da Next Fit.
export const NF_CLIENT_MAPPING = {
  name: 'Nome',
  email: 'E-mail',
  whatsapp: 'Telefone',
  cpf: 'CPF',
  rg: 'RG',
  birthDate: 'Data de nascimento',
  registeredAt: 'Data de cadastro',
  sexo: 'Sexo',
  dor: 'Objetivo',
  vip: 'VIP',
  consultantName: 'Consultor',
  professorName: 'Professor',
  addrCep: 'Cep',
  addrStreet: 'Endereco',
  addrNumber: 'Número',
  addrComplement: 'Complemento',
  addrNeighborhood: 'Bairro',
  addrCity: 'Cidade',
  contractSituation: 'Situação do contrato',
  clientSituation: 'Situação do cliente'
};

// "Situação do cliente" da Next Fit, normalizada, que conta como aluno ativo.
export const NF_ACTIVE = new Set(['ativo', 'suspenso']);

// Situações de contrato do Stronilead que contam como cliente ativo.
export const ACTIVE_CONTRACT = new Set(['ativo', 'a_vencer', 'trancado']);

// Valor da tabela de planos: não criar contrato para essa descrição.
export const PLAN_SKIP = '__skip__';

export const GROUPS = {
  SEM_CADASTRO: 'sem_cadastro',
  SO_LEAD: 'so_lead',
  CONTRATO_NAO_ATIVO: 'contrato_nao_ativo'
};

// ---------------------------------------------------------------------------
// Leitura das planilhas
// ---------------------------------------------------------------------------

// Lista de clientes: uma pessoa por linha, de qualquer situação. O filtro dos
// ativos fica com quem chama (NF_ACTIVE).
export function parsePeople(rows, now = new Date()) {
  return (rows || []).map((row, i) => {
    const c = parseRow(row, NF_CLIENT_MAPPING, i + 2, now);
    return {
      ...c,
      nf: normalizeName(row['Situação do cliente']),
      phoneKey: zapMatchKey(c.whatsappDigits)
    };
  });
}

// Relatório de contratos a vencer: um contrato por linha.
export function parseContracts(rows, now = new Date()) {
  const text = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  return (rows || []).map((r, i) => {
    const name = text(r['Cliente']);
    return {
      rowNumber: i + 2,
      name,
      nameLower: normalizeName(name),
      phoneKey: zapMatchKey(normalizePhoneDigits(r['FoneCliente'])),
      description: text(r['Descrição do contrato']),
      startsAt: parseImportDate(r['Início'], now),
      endsAt: parseImportDate(r['Encerramento'], now),
      professorName: text(r['Professor']) || null,
      consultantName: text(r['Consultor']) || null
    };
  });
}

// ---------------------------------------------------------------------------
// Casamento
// ---------------------------------------------------------------------------

const firstNameOf = (nameLower) => String(nameLower || '').split(' ')[0];

// Itens precisam de cpfDigits, phoneKey e nameLower.
export function buildIndex(items) {
  const byCpf = new Map();
  const byPhone = new Map();
  const byName = new Map();
  const push = (map, key, it) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  };
  for (const it of items || []) {
    push(byCpf, it.cpfDigits, it);
    push(byPhone, it.phoneKey, it);
    push(byName, it.nameLower, it);
  }
  return { byCpf, byPhone, byName };
}

const pickOne = (list, prefer) => {
  if (list.length === 1) return { item: list[0] };
  const preferred = prefer ? list.filter(prefer) : [];
  if (preferred.length === 1) return { item: preferred[0] };
  return { ambiguous: list };
};

// Ordem do spec: CPF, telefone com o mesmo primeiro nome, nome completo. O
// primeiro critério que acha alguém decide; com mais de um candidato (e sem um
// único preferido) a pessoa é ambígua e nada é gravado nela.
export function matchOne(probe, index, { prefer } = {}) {
  const tries = [
    ['cpf', probe.cpfDigits ? index.byCpf.get(probe.cpfDigits) || [] : []],
    ['phone', (probe.phoneKey ? index.byPhone.get(probe.phoneKey) || [] : [])
      .filter((it) => firstNameOf(it.nameLower) === firstNameOf(probe.nameLower))],
    ['name', probe.nameLower ? index.byName.get(probe.nameLower) || [] : []]
  ];
  for (const [kind, list] of tries) {
    if (!list.length) continue;
    const r = pickOne(list, prefer);
    return r.item
      ? { kind, item: r.item, candidates: [] }
      : { kind: 'ambiguous', item: null, candidates: r.ambiguous };
  }
  return { kind: 'none', item: null, candidates: [] };
}

// Ficha do Stronilead no formato do índice.
export function leadItem(lead) {
  return {
    id: lead.id,
    lead,
    nameLower: normalizeName(lead.name),
    cpfDigits: onlyDigits(lead.cpfDigits || lead.cpf) || null,
    phoneKey: lead.zapMatchKey || zapMatchKey(lead.whatsapp) || null,
    isClient: isClientLead(lead)
  };
}

// Liga cada contrato do relatório a uma pessoa da lista (de qualquer situação)
// por telefone e nome. A pessoa fica com o contrato de fim mais distante.
// O relatório só traz contrato vigente, então entre homônimos vale quem é
// ativo na Next Fit. `orphans`: contrato sem pessoa (inclui o ambíguo).
// `onInactive`: contrato de quem não é ativo na Next Fit (os bloqueados com
// contrato vigente).
export function attachContracts(people, contracts) {
  const index = buildIndex(people);
  const contractsOf = new Map();
  const orphans = [];
  const prefer = (p) => NF_ACTIVE.has(p.nf);
  for (const contract of contracts || []) {
    const r = matchOne({ cpfDigits: null, phoneKey: contract.phoneKey, nameLower: contract.nameLower }, index, { prefer });
    if (!r.item) { orphans.push({ contract, kind: r.kind }); continue; }
    if (!contractsOf.has(r.item)) contractsOf.set(r.item, []);
    contractsOf.get(r.item).push(contract);
  }
  const end = (c) => (c.endsAt ? c.endsAt.getTime() : -Infinity);
  const latest = (list) => list.reduce((a, b) => (end(b) > end(a) ? b : a));
  const withContracts = (people || []).map((p) => {
    const list = contractsOf.get(p) || [];
    return { ...p, contract: list.length ? latest(list) : null, contractCount: list.length };
  });
  return {
    people: withContracts,
    orphans,
    onInactive: withContracts.filter((p) => p.contract && !NF_ACTIVE.has(p.nf))
  };
}

// Casa as pessoas com as fichas do Stronilead. Entre homônimos, vale o cliente.
export function matchPeopleToLeads(people, leads) {
  const index = buildIndex((leads || []).map(leadItem));
  return (people || []).map((person) => ({
    person,
    ...matchOne(person, index, { prefer: (it) => it.isClient })
  }));
}

// ---------------------------------------------------------------------------
// Etapa 1: CPF e nascimento
// ---------------------------------------------------------------------------

const blank = (v) => v == null || v === '';

// Só o campo vazio recebe a Next Fit. CPF diferente do da ficha é conflito:
// nada é gravado e a pessoa vai para o relatório. Quando o CPF entra, os
// campos de busca são recalculados com o que fica gravado, como o
// buildFillPatch da importação.
export function etapa1Patch(person, lead) {
  const cpfOnLead = onlyDigits(lead.cpfDigits || lead.cpf);
  if (person.cpfDigits && cpfOnLead && cpfOnLead !== person.cpfDigits) {
    return { patch: {}, conflict: true };
  }
  const patch = {};
  if (!cpfOnLead && person.cpfDigits) patch.cpf = formatCPF(person.cpfDigits);
  if (blank(lead.birthDate) && person.birthDate) patch.birthDate = person.birthDate;
  if (patch.cpf) {
    Object.assign(patch, buildLeadSearchFields({ name: lead.name, whatsapp: lead.whatsapp, cpf: patch.cpf }));
  }
  return { patch, conflict: false };
}

// `matched` vem de matchPeopleToLeads, só com pessoas ativas na Next Fit.
// A etapa 1 mexe só em quem já é cliente: lead e quem não tem ficha são da
// etapa 2.
export function planEtapa1(matched) {
  const writes = [];
  const conflicts = [];
  const ambiguous = [];
  for (const m of matched) {
    if (m.kind === 'ambiguous') { ambiguous.push(m); continue; }
    if (m.kind === 'none' || !m.item.isClient) continue;
    const { patch, conflict } = etapa1Patch(m.person, m.item.lead);
    if (conflict) { conflicts.push(m); continue; }
    if (!Object.keys(patch).length) continue;
    writes.push({
      leadId: m.item.id,
      patch,
      fills: [patch.cpf && 'CPF', patch.birthDate && 'nascimento'].filter(Boolean),
      m
    });
  }
  return { writes, conflicts, ambiguous };
}

// ---------------------------------------------------------------------------
// Etapa 2: matrículas que faltam
// ---------------------------------------------------------------------------

// Separa as pessoas ativas na Next Fit em três grupos de gravação e nas listas
// que ficam para decisão humana. Quem já é cliente ativo no Stronilead não
// entra em nada: só conta em jaAtivos.
export function planEtapa2(matched, now = new Date()) {
  const out = {
    groups: { [GROUPS.SEM_CADASTRO]: [], [GROUPS.SO_LEAD]: [], [GROUPS.CONTRATO_NAO_ATIVO]: [] },
    jaAtivos: 0,
    ambiguous: [],
    conflicts: [],
    semContrato: [],
    contratoInvalido: []
  };
  for (const m of matched) {
    if (!NF_ACTIVE.has(m.person.nf)) continue;
    if (m.kind === 'ambiguous') { out.ambiguous.push(m); continue; }
    const lead = m.item?.lead || null;
    if (lead && etapa1Patch(m.person, lead).conflict) { out.conflicts.push(m); continue; }
    if (lead && m.item.isClient && ACTIVE_CONTRACT.has(deriveLeadContractStatus(lead, now))) {
      out.jaAtivos += 1;
      continue;
    }
    const ct = m.person.contract;
    if (!ct) { out.semContrato.push(m); continue; }
    if (!ct.startsAt || !ct.endsAt || ct.endsAt.getTime() < ct.startsAt.getTime()) {
      out.contratoInvalido.push(m);
      continue;
    }
    const group = !lead ? GROUPS.SEM_CADASTRO : !m.item.isClient ? GROUPS.SO_LEAD : GROUPS.CONTRATO_NAO_ATIVO;
    out.groups[group].push(m);
  }
  return out;
}

// Cliente ativo no Stronilead que nenhuma pessoa ativa da Next Fit explica.
// Candidatos de um casamento ambíguo contam como explicados.
export function extrasInStronilead(matched, leads, now = new Date()) {
  const seen = new Set();
  for (const m of matched) {
    if (m.item) seen.add(m.item.id);
    for (const c of m.candidates) seen.add(c.id);
  }
  return (leads || []).filter((l) =>
    isClientLead(l) && ACTIVE_CONTRACT.has(deriveLeadContractStatus(l, now)) && !seen.has(l.id));
}

// A Next Fit escreve o nome completo ("Ana Julia Kubiczewski dos Santos") e o
// Stronilead guarda o curto ("Ana Júlia"). Nome igual ganha; senão vale o único
// item da lista com duas palavras ou mais, todas presentes no nome completo.
// Mais de um candidato, ou nenhum, devolve null: o cadastro nasce sem dono em
// vez de nascer com o dono errado.
export function resolveByName(list, name) {
  const key = normalizeName(name);
  if (!key) return null;
  const exact = (list || []).find((x) => normalizeName(x?.name) === key);
  if (exact) return exact;
  const words = new Set(key.split(' '));
  const found = (list || []).filter((x) => {
    const parts = normalizeName(x?.name).split(' ').filter(Boolean);
    return parts.length >= 2 && parts.every((w) => words.has(w));
  });
  return found.length === 1 ? found[0] : null;
}

// A pessoa + o contrato do relatório, no formato de candidato da importação.
// Consultor e professor já saem com o nome que o Stronilead conhece, para o
// enrichCandidate (que compara o nome inteiro) achá-los.
const toCandidate = (person, { usersList = [], professores = [] } = {}) => {
  const consultantName = person.consultantName || person.contract.consultantName;
  const professorName = person.professorName || person.contract.professorName;
  return {
    ...person,
    planName: person.contract.description,
    startsAt: person.contract.startsAt,
    endsAt: person.contract.endsAt,
    consultantName: resolveByName(usersList, consultantName)?.name ?? consultantName,
    professorName: resolveByName(professores, professorName)?.name ?? professorName
  };
};

// Monta as gravações da etapa 2 com o mesmo construtor da importação de
// clientes (contrato e ficha marcados como importados). `planMap` liga a
// descrição normalizada a um id de plano, a PLAN_AS_TEXT ou a PLAN_SKIP.
// Descrição sem plano do catálogo e sem ligação entra em `unmapped` e não gera
// gravação: o script recusa o --apply enquanto a lista não estiver vazia.
export function buildEtapa2Items(groups, {
  usersList = [], professores = [], planos = [], planMap = {},
  funnelId = null, importMeta, now = new Date()
}) {
  const items = [];
  const skipped = [];
  const unmapped = new Map();
  for (const group of Object.values(GROUPS)) {
    for (const m of groups[group] || []) {
      const c = enrichCandidate(toCandidate(m.person, { usersList, professores }), { usersList, professores, planos, planMap });
      const key = normalizeName(c.planName);
      if (planMap[key] === PLAN_SKIP) { skipped.push({ group, m }); continue; }
      if (!c.plan && planMap[key] !== PLAN_AS_TEXT) {
        const cur = unmapped.get(key) || { key, label: c.planName, count: 0 };
        cur.count += 1;
        unmapped.set(key, cur);
        continue;
      }
      const lead = m.item?.lead || null;
      const fill = lead ? etapa1Patch(c, lead).patch : null;
      const consultant = c.consultant
        ? { id: c.consultant.id, name: c.consultant.name, authUid: c.consultant.authUid ?? null }
        : null;
      const w = buildImportedClientWrites({
        c, cls: { lead, fill, createContract: true }, consultant, funnelId, importMeta, now
      });
      items.push({ ...w, group, rowNumber: c.rowNumber });
    }
  }
  return { items, skipped, unmapped: [...unmapped.values()] };
}

// O Firestore de servidor recusa undefined. O dry-run chama isto em cada
// gravação para o problema aparecer antes do --apply.
export function findUndefined(value, path = '') {
  if (value === undefined) return path || '(raiz)';
  if (value === null || typeof value !== 'object' || value instanceof Date) return null;
  for (const [k, v] of Object.entries(value)) {
    const p = findUndefined(v, path ? `${path}.${k}` : k);
    if (p) return p;
  }
  return null;
}
