// Regra pura da IMPORTAÇÃO DE CLIENTES de outros sistemas (NextFit, Pacto,
// Evo, SCA, Tecnofit): normalizadores, linha → candidato, dedupe no arquivo,
// escopo, casamento com a base, classificação e o construtor das escritas.
// Sem React e sem Firestore: o COMO gravar fica em clientImportWrites.js
// (padrão contracts.js / contractsWrites.js).
// Spec: docs/superpowers/specs/2026-09-03-importacao-clientes-design.md

import { normalize, onlyDigits } from './globalSearch.js';
import { addMonths, daysBetween, getSafeDateOrNull } from './dates.js';
import { formatCPF, formatPhone } from './masks.js';
import { parseValorBRL } from './format.js';
import { buildLeadSearchFields, deriveLeadBucket } from './leadDerived.js';
import { isClientLead } from './leads.js';
import { CONTRACT_STATUS, deriveContractStatus } from './contracts.js';
import { DEFAULT_EXPIRED_WINDOW_DAYS } from './expiredGoal.js';

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

// Telefone como o app grava: DDD + número, 10 ou 11 dígitos, sem o 55 do país
// (formatPhone, em masks.js, corta em 11; exportação com 5571... nunca
// casaria). Fora disso devolve null: a linha guarda o bruto e não casa.
export const normalizePhoneDigits = (raw) => {
  let d = onlyDigits(raw);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13 || d.length === 14)) d = d.slice(2);
  // Prefixo de tronco legado ("0xx71", "0 71"): DDD nunca começa com 0.
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) d = d.slice(1);
  return d.length === 10 || d.length === 11 ? d : null;
};

// Dígito verificador do CPF. Sequência de um só algarismo é inválida (é o que
// sistema antigo grava quando ninguém informou, e amarraria dez pessoas numa).
export const isValidCpf = (digits) => {
  const d = String(digits || '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
};

// { digits, invalid }: digits só quando válido; invalid marca CPF preenchido
// mas errado (vira aviso na linha, sem barrar).
export const normalizeCpfDigits = (raw) => {
  // Célula numérica perde o zero à esquerda: completa até 11 antes de validar.
  const d = typeof raw === 'number' && Number.isFinite(raw) ? String(Math.trunc(raw)).padStart(11, '0') : onlyDigits(raw);
  if (!d) return { digits: null, invalid: false };
  return isValidCpf(d) ? { digits: d, invalid: false } : { digits: null, invalid: true };
};

// Chave de nome da planilha: normalize + espaços colapsados. O cadastro grava
// nameLower SEM colapsar espaços, por isso o casamento por nome (lookupExisting,
// em clientImportWrites.js) recompõe a chave a partir do name gravado com esta
// mesma função, em vez de comparar nameLower por igualdade.
export const normalizeName = (raw) => normalize(String(raw ?? '').replace(/\s+/g, ' ').trim());

const localDate = (y, m, d) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
};

// Data de célula → meia-noite LOCAL (igual ao fromDateInputValue do modal de
// matrícula). Aceita Date (SheetJS com cellDates), serial do Excel (número),
// 'dd/mm/aaaa', 'dd/mm/aa' e 'aaaa-mm-dd', com ou sem hora atrás. Ano de dois
// dígitos: até (ano atual + 10) é 20xx, acima é 19xx: contrato vence daqui a
// poucos anos, nascimento é décadas atrás.
// ISO com hora e fuso ("...T03:00:00Z") toma a data escrita ao pé da letra, sem
// converter fuso: a convenção do app é o dia local, e a planilha não traz instante.
export const parseImportDate = (raw, now = new Date()) => {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // 25569 = dias entre 30/12/1899 (época do Excel) e 01/01/1970.
    const utc = new Date(Math.round((raw - 25569) * 86400000));
    return localDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:\D.*)?$/);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += y <= (now.getFullYear() % 100) + 10 ? 2000 : 1900;
    return localDate(y, Number(m[2]), Number(m[1]));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\D.*)?$/);
  if (m) return localDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
};

// Valores que o select de sexo do app conhece (AddLeadModal /
// ClientRegistrationModal). Texto desconhecido passa como veio.
export const normalizeSexo = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (s === 'm' || s.startsWith('masc')) return 'Masculino';
  if (s === 'f' || s.startsWith('fem')) return 'Feminino';
  if (s === 'o' || s.startsWith('outro')) return 'Outro';
  return String(raw).trim();
};

export const isTruthyCell = (raw) => {
  if (raw === true) return true;
  if (typeof raw === 'number') return raw > 0;
  return /^(sim|s|x|true|1|vip|yes|y)$/i.test(String(raw ?? '').trim());
};

export const CONTRACT_SITUATION = {
  ATIVO: 'ativo',
  A_VENCER: 'a_vencer',
  VENCIDO: 'vencido',
  CANCELADO: 'cancelado',
  TRANCADO: 'trancado',
  DESCONHECIDO: 'desconhecido'
};

// Texto livre da coluna "Situação do contrato" → slug. A ordem importa:
// "a vencer" contém "vencer" e "inativo" contém "ativ".
export const contractSituationFromText = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  // "Pré-cancelado" / "a cancelar" ainda está vigente até o fim: é ativo, e a
  // data de fim decide o resto.
  if (/pre[- ]?cancel|a cancelar|cancelamento (agendado|programado)/.test(s)) return CONTRACT_SITUATION.ATIVO;
  if (/cancel/.test(s)) return CONTRACT_SITUATION.CANCELADO;
  if (/tranc|pausa|suspens|congel/.test(s)) return CONTRACT_SITUATION.TRANCADO;
  if (/a vencer|vencendo|renov/.test(s)) return CONTRACT_SITUATION.A_VENCER;
  if (/venc|expir|inativ|encerr|finaliz/.test(s)) return CONTRACT_SITUATION.VENCIDO;
  if (/ativ|vigente|em dia|normal|regular/.test(s)) return CONTRACT_SITUATION.ATIVO;
  return CONTRACT_SITUATION.DESCONHECIDO;
};

// "Situação do cliente" → 'ativo' | 'inativo' | null (desconhecido conta como
// não-inativo no escopo).
export const clientSituationFromText = (raw) => {
  const s = normalizeName(raw);
  if (!s) return null;
  if (/inativ|cancel|bloque|desativ/.test(s)) return 'inativo';
  if (/ativ/.test(s)) return 'ativo';
  return null;
};

const fmtDia = (d) => {
  const x = getSafeDateOrNull(d);
  return x ? x.toLocaleDateString('pt-BR') : '';
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const earliest = (...dates) => {
  const list = dates.map(getSafeDateOrNull).filter(Boolean);
  if (!list.length) return null;
  return list.reduce((min, d) => (d.getTime() < min.getTime() ? d : min));
};

// ---------------------------------------------------------------------------
// Linha → candidato
// ---------------------------------------------------------------------------

const cell = (row, mapping, field) => {
  const header = mapping?.[field];
  return header ? row?.[header] : undefined;
};
const str = (v) => (v == null ? '' : String(v).trim());
const nullify = (v) => (str(v) ? str(v) : null);
// Célula numérica perde o zero à esquerda (CEP 04567000 chega como 4567000):
// completa até 8 dígitos. Texto passa como está.
const cepStr = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.trunc(v)).padStart(8, '0') : str(v));

export const parseRow = (row, mapping, rowNumber, now = new Date()) => {
  const get = (field) => cell(row, mapping, field);
  const name = str(get('name')).replace(/\s+/g, ' ');
  const cpf = normalizeCpfDigits(get('cpf'));
  const whatsappRaw = str(get('whatsapp'));
  const address = {
    cep: cepStr(get('addrCep')), street: str(get('addrStreet')), number: str(get('addrNumber')),
    complement: str(get('addrComplement')), neighborhood: str(get('addrNeighborhood')),
    city: str(get('addrCity')), state: ''
  };
  const hasAddress = Object.values(address).some(Boolean);
  const warnings = [];
  if (cpf.invalid) warnings.push('CPF inválido');
  const contractSituation = contractSituationFromText(get('contractSituation'));
  if (contractSituation === CONTRACT_SITUATION.DESCONHECIDO) warnings.push('Situação do contrato desconhecida');
  const endsRaw = get('contractEndsAt');
  const endsAt = parseImportDate(endsRaw, now);
  if (str(endsRaw) && !endsAt) warnings.push('Data de fim ilegível');
  const value = parseValorBRL(get('contractValue'));
  return {
    rowNumber,
    name,
    nameLower: normalizeName(name),
    email: nullify(get('email')),
    whatsappRaw,
    whatsappDigits: normalizePhoneDigits(whatsappRaw),
    cpfDigits: cpf.digits,
    cpfInvalid: cpf.invalid,
    rg: nullify(get('rg')),
    birthDate: parseImportDate(get('birthDate'), now),
    registeredAt: parseImportDate(get('registeredAt'), now),
    sexo: normalizeSexo(get('sexo')),
    dor: nullify(get('dor')),
    vip: isTruthyCell(get('vip')),
    address: hasAddress ? address : null,
    consultantName: nullify(get('consultantName')),
    professorName: nullify(get('professorName')),
    planName: nullify(get('planName')),
    contractSituation,
    clientSituation: clientSituationFromText(get('clientSituation')),
    startsAt: parseImportDate(get('contractStartsAt'), now),
    endsAt,
    value: Number.isFinite(value) ? value : null,
    warnings
  };
};

// Sem nome, ou sem CPF válido e sem telefone válido, a linha não casa nem nasce.
export const isCandidateValid = (c) =>
  String(c?.name || '').length > 1 && Boolean(c?.cpfDigits || c?.whatsappDigits);

// Duplicata dentro do arquivo: mesmo CPF (ou, sem CPF, mesmo telefone) vira
// uma só antes de qualquer consulta. Fica a linha válida sobre a inválida;
// entre válidas, a de fim mais recente (null perde; empate fica com a
// primeira). As outras saem com `duplicateOf` = linha que ficou, para o
// relatório.
export const dedupeInFile = (candidates) => {
  const keyOf = (c) => (c.cpfDigits ? `cpf:${c.cpfDigits}` : c.whatsappDigits ? `tel:${c.whatsappDigits}` : null);
  const groups = new Map();
  const kept = [];
  const duplicates = [];
  (candidates || []).forEach((c) => {
    const key = keyOf(c);
    if (!key) { kept.push(c); return; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  groups.forEach((list) => {
    const winner = list.reduce((best, c) => {
      // Válida vence inválida; entre iguais, o fim mais recente (empate: a primeira).
      const validBest = isCandidateValid(best);
      const validC = isCandidateValid(c);
      if (validC !== validBest) return validC ? c : best;
      const a = best.endsAt ? best.endsAt.getTime() : -Infinity;
      const b = c.endsAt ? c.endsAt.getTime() : -Infinity;
      return b > a ? c : best;
    });
    kept.push(winner);
    list.forEach((c) => { if (c !== winner) duplicates.push({ ...c, duplicateOf: winner.rowNumber }); });
  });
  kept.sort((a, b) => a.rowNumber - b.rowNumber);
  duplicates.sort((a, b) => a.rowNumber - b.rowNumber);
  return { kept, duplicates };
};

// Nomes de plano distintos da planilha, para a tabela de mapeamento de planos.
export const distinctPlanNames = (candidates) => {
  const map = new Map();
  (candidates || []).forEach((c) => {
    const key = normalizeName(c.planName);
    if (!key) return;
    const cur = map.get(key);
    if (cur) cur.count += 1;
    else map.set(key, { key, label: str(c.planName), count: 1 });
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
};

// ---------------------------------------------------------------------------
// Enriquecimento: consultor, professor e plano por nome normalizado
// ---------------------------------------------------------------------------

const findByName = (list, name) => {
  const key = normalizeName(name);
  if (!key) return null;
  return (list || []).find((x) => normalizeName(x?.name) === key) || null;
};

// Valor especial do mapeamento de planos: "manter como texto" (não casa com o
// catálogo mesmo que o nome bata).
export const PLAN_AS_TEXT = '__text__';

export const enrichCandidate = (c, { usersList, professores, planos, planMap } = {}) => {
  const consultant = findByName(usersList, c.consultantName);
  const professor = findByName(professores, c.professorName);
  const planKey = normalizeName(c.planName);
  let plan = null;
  if (planKey) {
    const mapped = planMap?.[planKey];
    if (mapped === PLAN_AS_TEXT) plan = null;
    else if (mapped) plan = (planos || []).find((p) => p.id === mapped) || null;
    else plan = (planos || []).find((p) => normalizeName(p.name) === planKey) || null;
  }
  return {
    ...c,
    consultant,
    professorId: professor?.id || null,
    professorName: professor ? professor.name : c.professorName,
    plan
  };
};

// ---------------------------------------------------------------------------
// Escopo
// ---------------------------------------------------------------------------

export const SCOPE = { PADRAO: 'padrao', TODOS: 'todos' };

// Padrão = ativos e vencidos recentes. Com data de fim, o relógio decide (é a
// mesma deriveContractStatus do app): vigente entra, vencido só se venceu há
// no máximo `windowDays` (janela de Vencidos da academia). Trancado entra
// sempre, cancelado nunca. Sem data de fim, manda a situação do cliente
// (desconhecida conta como ativa).
export const isInScope = (c, scope, now, windowDays) => {
  if (scope === SCOPE.TODOS) return true;
  if (c.contractSituation === CONTRACT_SITUATION.CANCELADO) return false;
  if (c.contractSituation === CONTRACT_SITUATION.TRANCADO) return true;
  const endsAt = getSafeDateOrNull(c.endsAt);
  if (!endsAt) return c.clientSituation !== 'inativo';
  const derived = deriveContractStatus({ status: CONTRACT_STATUS.ATIVO, startsAt: c.startsAt, endsAt }, now);
  if (derived !== CONTRACT_STATUS.VENCIDO) return true;
  // endsAt é meia-noite local; `now` no assistente é hora de relógio. Sem
  // truncar, Math.round de daysBetween empurrava o limite da janela um dia
  // conforme a hora em que o gestor clicasse. Compara dia contra dia.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const win = Number.isFinite(Number(windowDays)) ? Number(windowDays) : DEFAULT_EXPIRED_WINDOW_DAYS;
  return daysBetween(endsAt, today) <= win;
};

// ---------------------------------------------------------------------------
// Casamento com a base
// ---------------------------------------------------------------------------

// `index` vem de lookupExisting (clientImportWrites.js): três Maps, chaveados
// por cpfDigits, whatsappDigits e o nome normalizado (este com a lista de
// homônimos).
export const resolveMatch = (c, index) => {
  const byCpf = c.cpfDigits ? index?.byCpf?.get(c.cpfDigits) : null;
  if (byCpf) return { kind: 'cpf', lead: byCpf, homonyms: [] };
  const byPhone = c.whatsappDigits ? index?.byPhone?.get(c.whatsappDigits) : null;
  if (byPhone) return { kind: 'phone', lead: byPhone, homonyms: [] };
  const homonyms = c.nameLower ? (index?.byName?.get(c.nameLower) || []) : [];
  if (homonyms.length) return { kind: 'name', lead: null, homonyms };
  return { kind: 'none', lead: null, homonyms: [] };
};

// ---------------------------------------------------------------------------
// Promover o existente: a planilha só preenche o que está vazio
// ---------------------------------------------------------------------------

const blank = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

// Rótulos pt-BR do que a planilha preencheu, para o motivo na revisão.
const FILL_LABEL = { whatsapp: 'telefone', email: 'e-mail', cpf: 'CPF', rg: 'RG', birthDate: 'nascimento', sexo: 'sexo', dor: 'objetivo', address: 'endereço', professorId: 'professor', tags: 'etiqueta VIP' };
const fillSummary = (fill) => [...new Set(Object.keys(fill).map((k) => FILL_LABEL[k]).filter(Boolean))].join(', ');

// Nome e consultor dono NUNCA entram aqui (decisão do spec). Telefone e CPF
// entram só se vazios, e quando entram os campos de busca são recomputados
// com o que vai ficar gravado (dual-write, como o cadastro faz).
export const buildFillPatch = (c, lead) => {
  const patch = {};
  if (blank(lead.whatsapp) && c.whatsappDigits) patch.whatsapp = formatPhone(c.whatsappDigits);
  if (blank(lead.email) && c.email) patch.email = c.email;
  if (blank(lead.cpf) && c.cpfDigits) patch.cpf = formatCPF(c.cpfDigits);
  if (blank(lead.rg) && c.rg) patch.rg = c.rg;
  if (blank(lead.birthDate) && c.birthDate) patch.birthDate = c.birthDate;
  if (blank(lead.sexo) && c.sexo) patch.sexo = c.sexo;
  if (blank(lead.dor) && c.dor) patch.dor = c.dor;
  // Endereço entra campo a campo: o cadastro completo pode ter gravado só a
  // cidade, e o resto que a planilha traz ainda cabe. Só grava se acrescentar.
  if (c.address) {
    const cur = lead.address && typeof lead.address === 'object' ? lead.address : {};
    const adds = Object.fromEntries(Object.entries(c.address).filter(([k, v]) => v && blank(cur[k])));
    if (Object.keys(adds).length) patch.address = { ...cur, ...adds };
  }
  if (blank(lead.professorId) && c.professorId) {
    patch.professorId = c.professorId;
    patch.professorName = c.professorName;
  }
  if (c.vip && !(lead.tags || []).includes('VIP')) patch.tags = [...(lead.tags || []), 'VIP'];
  if (patch.whatsapp || patch.cpf) {
    Object.assign(patch, buildLeadSearchFields({
      name: lead.name,
      whatsapp: patch.whatsapp || lead.whatsapp,
      cpf: patch.cpf || lead.cpf
    }));
  }
  return patch;
};

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

export const OUTCOME = {
  CRIAR: 'criar',
  PROMOVER: 'promover',
  REGISTRAR_CONTRATO: 'registrar_contrato',
  ATUALIZAR: 'atualizar',
  SEM_ALTERACAO: 'sem_alteracao',
  CONFLITO: 'conflito',
  SUSPEITA: 'suspeita',
  INVALIDA: 'invalida',
  FORA_DO_ESCOPO: 'fora_do_escopo',
  DUPLICADA: 'duplicada_no_arquivo',
  ERRO: 'erro'
};

export const OUTCOME_LABEL = {
  criar: 'Criado',
  promover: 'Promovido a cliente',
  registrar_contrato: 'Contrato registrado',
  atualizar: 'Dados preenchidos',
  sem_alteracao: 'Sem alteração',
  conflito: 'Conflito (pulada)',
  suspeita: 'Suspeita por nome',
  invalida: 'Inválida',
  fora_do_escopo: 'Fora do escopo',
  duplicada_no_arquivo: 'Duplicada no arquivo',
  erro: 'Erro na gravação'
};

// Só estes chegam ao Firestore.
export const WRITABLE_OUTCOMES = [OUTCOME.CRIAR, OUTCOME.PROMOVER, OUTCOME.REGISTRAR_CONTRATO, OUTCOME.ATUALIZAR];

// `decision` (suspeita por nome): undefined = ainda sem decisão; 'create' =
// cadastro novo; qualquer outro valor = id do homônimo a usar.
export const classifyCandidate = (c, match, { decision, scope, now, windowDays }) => {
  if (c.duplicateOf) return { outcome: OUTCOME.DUPLICADA, reason: `Repetida da linha ${c.duplicateOf}`, lead: null, fill: null, createContract: false, homonyms: [] };
  if (!isCandidateValid(c)) {
    return { outcome: OUTCOME.INVALIDA, reason: String(c.name || '').length > 1 ? 'Sem CPF válido nem telefone válido' : 'Sem nome', lead: null, fill: null, createContract: false, homonyms: [] };
  }
  if (!isInScope(c, scope, now, windowDays)) {
    const reason = c.contractSituation === CONTRACT_SITUATION.CANCELADO ? 'Contrato cancelado'
      : c.endsAt ? `Venceu em ${fmtDia(c.endsAt)}, fora da janela`
        : 'Cliente inativo sem vigência';
    return { outcome: OUTCOME.FORA_DO_ESCOPO, reason, lead: null, fill: null, createContract: false, homonyms: [] };
  }
  let lead = match?.lead || null;
  const homonyms = match?.homonyms || [];
  if (match?.kind === 'name') {
    if (!decision) return { outcome: OUTCOME.SUSPEITA, reason: `Já existe "${homonyms[0]?.name}" na base`, lead: null, fill: null, createContract: false, homonyms };
    if (decision !== 'create') {
      lead = homonyms.find((h) => h.id === decision) || null;
      // Id que não está entre os homônimos (estado velho da tela): volta a
      // pedir decisão em vez de criar duplicata em silêncio.
      if (!lead) return { outcome: OUTCOME.SUSPEITA, reason: 'Decisão desatualizada, escolha de novo', lead: null, fill: null, createContract: false, homonyms };
    }
  }
  if (!lead) {
    return { outcome: OUTCOME.CRIAR, reason: c.endsAt ? 'Cadastro novo com contrato' : 'Cadastro novo sem vigência', lead: null, fill: null, createContract: Boolean(c.endsAt), homonyms: [] };
  }
  if (match?.kind === 'phone' && c.cpfDigits && lead.cpfDigits && lead.cpfDigits !== c.cpfDigits) {
    return { outcome: OUTCOME.CONFLITO, reason: 'CPF diferente do cadastro com este telefone', lead, fill: null, createContract: false, homonyms: [] };
  }
  const existingEnds = getSafeDateOrNull(lead.currentContractEndsAt);
  if (c.endsAt && lead.currentContractId && existingEnds && !sameDay(existingEnds, c.endsAt)) {
    return { outcome: OUTCOME.CONFLITO, reason: `Já tem contrato até ${fmtDia(existingEnds)}`, lead, fill: null, createContract: false, homonyms: [] };
  }
  const fill = buildFillPatch(c, lead);
  const createContract = Boolean(c.endsAt) && !lead.currentContractId;
  if (!isClientLead(lead)) {
    return { outcome: OUTCOME.PROMOVER, reason: createContract ? 'Lead vira cliente com contrato' : 'Lead vira cliente sem vigência', lead, fill, createContract, homonyms: [] };
  }
  if (createContract) return { outcome: OUTCOME.REGISTRAR_CONTRATO, reason: `Vigência até ${fmtDia(c.endsAt)}`, lead, fill, createContract, homonyms: [] };
  if (Object.keys(fill).length) return { outcome: OUTCOME.ATUALIZAR, reason: `Preenche ${fillSummary(fill)}`, lead, fill, createContract: false, homonyms: [] };
  return { outcome: OUTCOME.SEM_ALTERACAO, reason: 'Já está igual', lead, fill: null, createContract: false, homonyms: [] };
};

// ---------------------------------------------------------------------------
// Contrato importado
// ---------------------------------------------------------------------------

// Meses inteiros entre duas datas (mínimo 1), ou null.
const monthsBetween = (a, b) => {
  const days = daysBetween(a, b);
  if (days == null) return null;
  const m = Math.round(days / 30.4375);
  return m >= 1 ? m : null;
};

// Mesmo shape do `contract` de buildMatriculaWrites (contracts.js), com
// startsAt/endsAt vindos da planilha. A importação NUNCA inventa data: fim é
// obrigatório (o caller só chama com c.endsAt); início real se veio, inferido
// (fim menos a duração do plano do catálogo, marcado) se der, senão nulo.
export const buildImportedContract = (c, { owner, leadName, importMeta }) => {
  const plan = c.plan || null;
  const planMonths = Number(plan?.durationMonths) || 0;
  const startsAt = c.startsAt || (planMonths > 0 ? addMonths(c.endsAt, -planMonths) : null);
  const startsAtInferred = !c.startsAt && Boolean(startsAt);
  const durationMonths = planMonths > 0 ? planMonths : (c.startsAt ? monthsBetween(c.startsAt, c.endsAt) : null);
  const status = c.contractSituation === CONTRACT_SITUATION.CANCELADO ? CONTRACT_STATUS.CANCELADO
    : c.contractSituation === CONTRACT_SITUATION.TRANCADO ? CONTRACT_STATUS.TRANCADO
      : CONTRACT_STATUS.ATIVO;
  const listValue = Number(plan?.value) || 0;
  const value = Number.isFinite(Number(c.value)) && c.value != null ? Number(c.value) : listValue;
  return {
    leadId: null,
    leadName: leadName || null,
    planId: plan?.id || null,
    planName: plan?.name || c.planName || null,
    value,
    listValue,
    durationMonths,
    startsAt,
    endsAt: c.endsAt,
    status,
    cancelledAt: status === CONTRACT_STATUS.CANCELADO ? c.endsAt : null,
    cancelReason: null,
    // Trancado sem data de pausa na planilha: a importação é o melhor dado
    // que existe; a reativação pela ficha empurra o fim a partir daí.
    pausedAt: status === CONTRACT_STATUS.TRANCADO ? (importMeta.now ?? null) : null,
    renewedFromId: null,
    startsAtInferred,
    consultantId: owner.consultantId,
    consultantName: owner.consultantName,
    consultantAuthUid: owner.consultantAuthUid,
    importedBy: importMeta.importedBy,
    importSource: importMeta.importSource,
    importBatchId: importMeta.importBatchId
  };
};

// ---------------------------------------------------------------------------
// Escritas do lead (o QUE gravar; o COMO fica em clientImportWrites.js)
// ---------------------------------------------------------------------------

// Espelho do patch que commitMatricula grava (contractsWrites.js).
const CLIENT_MARKS = {
  status: 'Venda',
  isConverted: true,
  lifecycleStage: 'cliente',
  lossReason: null,
  lostAt: null,
  nextFollowUp: null,
  renewalHandledCheckpoints: [],
  renewalDeclined: false,
  reactivationStageId: null
};

const contractSummary = (contract) => (contract ? {
  currentPlanName: contract.planName,
  currentContractValue: contract.value,
  currentContractStartsAt: contract.startsAt,
  currentContractEndsAt: contract.endsAt,
  currentContractStatus: contract.status
} : {});

// "do NextFit" / "de planilha": a origem sem preset não leva artigo.
const sourcePhrase = (label) => (label === 'planilha' ? 'de planilha' : `do ${label}`);
const sourceField = (label) => (label === 'planilha' ? 'Importação por planilha' : `Importação ${label}`);

export const buildImportInteractionText = ({ sourceLabel, contract }) =>
  `Cadastro importado ${sourcePhrase(sourceLabel)}. ${contract
    ? `Plano ${contract.planName || 'sem nome'}, vigência até ${fmtDia(contract.endsAt)}.`
    : 'Sem vigência registrada.'}`;

// `consultant` é o dono para cadastro NOVO (ou para lead existente sem dono):
// o consultor da linha quando casou, senão o padrão escolhido no assistente.
// Lead existente com dono mantém o dono, sempre.
export const buildImportedClientWrites = ({ c, cls, consultant, funnelId, importMeta, now }) => {
  const lead = cls?.lead || null;
  const isNew = !lead;

  const owner = lead?.consultantId
    ? { consultantId: lead.consultantId, consultantName: lead.consultantName ?? null, consultantAuthUid: lead.consultantAuthUid ?? null }
    : { consultantId: consultant?.id ?? null, consultantName: consultant?.name ?? null, consultantAuthUid: consultant?.authUid ?? null };

  const leadName = lead?.name || c.name;
  const contract = cls?.createContract && c.endsAt
    ? buildImportedContract(c, { owner, leadName, importMeta })
    : null;

  // Data histórica: início real, data de cadastro, ou o início inferido do
  // contrato (fim menos a duração do plano). Só sem nenhuma delas cai em hoje.
  const historical = c.startsAt || c.registeredAt || contract?.startsAt || null;
  const convertedAt = historical || now;
  const warnings = [...(c.warnings || [])];
  if (!historical) warnings.push('Sem data histórica: conta como venda de hoje');

  const stamps = { importedBy: importMeta.importedBy, importSource: importMeta.importSource, importBatchId: importMeta.importBatchId };

  let leadData;
  if (isNew) {
    const whatsapp = c.whatsappDigits ? formatPhone(c.whatsappDigits) : c.whatsappRaw;
    const cpf = c.cpfDigits ? formatCPF(c.cpfDigits) : null;
    leadData = {
      name: c.name,
      whatsapp,
      email: c.email,
      cpf,
      rg: c.rg,
      birthDate: c.birthDate,
      sexo: c.sexo,
      dor: c.dor,
      modalidade: null,
      address: c.address,
      tags: c.vip ? ['VIP'] : [],
      source: sourceField(importMeta.sourceLabel),
      observation: '',
      funnelId: funnelId ?? null,
      professorId: c.professorId || null,
      professorName: c.professorId ? c.professorName : null,
      referredById: null,
      referredByName: null,
      ...owner,
      ...CLIENT_MARKS,
      ...contractSummary(contract),
      ...buildLeadSearchFields({ name: c.name, whatsapp, cpf }),
      createdAt: c.registeredAt || now,
      convertedAt,
      clienteSince: earliest(c.registeredAt, c.startsAt, contract?.startsAt) || now,
      lastInteractionAt: null,
      interactionsCount: 0,
      nextFollowUpType: null,
      appointmentType: null,
      appointmentScheduledFor: null,
      ...stamps
    };
    leadData.lifecycleBucket = deriveLeadBucket(leadData);
  } else {
    const promote = !isClientLead(lead);
    leadData = {
      ...(cls.fill || {}),
      ...(lead.consultantId ? {} : owner),
      ...(promote ? CLIENT_MARKS : {}),
      ...contractSummary(contract),
      ...(promote ? { convertedAt: getSafeDateOrNull(lead.convertedAt) || convertedAt } : {}),
      ...(lead.clienteSince ? {} : { clienteSince: earliest(c.registeredAt, c.startsAt, contract?.startsAt) || now }),
      ...stamps
    };
    leadData.lifecycleBucket = deriveLeadBucket({ ...lead, ...leadData });
  }

  return {
    isNew,
    leadId: lead?.id || null,
    leadName,
    leadData,
    contract,
    interactionText: buildImportInteractionText({ sourceLabel: importMeta.sourceLabel, contract }),
    owner,
    warnings
  };
};

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

export const summarizeOutcomes = (results) => {
  const s = Object.fromEntries(Object.values(OUTCOME).map((k) => [k, 0]));
  s.semVigencia = 0;
  s.avisos = 0;
  s.gravaveis = 0;
  const planos = new Set();
  const consultores = new Set();
  const professores = new Set();
  (results || []).forEach(({ c, cls }) => {
    s[cls.outcome] = (s[cls.outcome] || 0) + 1;
    if ((c.warnings || []).length) s.avisos += 1;
    if (!WRITABLE_OUTCOMES.includes(cls.outcome)) return;
    s.gravaveis += 1;
    if ((cls.outcome === OUTCOME.CRIAR || cls.outcome === OUTCOME.PROMOVER) && !c.endsAt) s.semVigencia += 1;
    if (cls.createContract && c.planName && !c.plan) planos.add(c.planName);
    if (c.consultantName && !c.consultant && !cls.lead?.consultantId) consultores.add(c.consultantName);
    if (c.professorName && !c.professorId) professores.add(c.professorName);
  });
  s.planosForaDoCatalogo = [...planos];
  s.consultoresNaoReconhecidos = [...consultores];
  s.professoresNaoReconhecidos = [...professores];
  return s;
};

// CSV para o Excel em pt-BR: BOM, ponto e vírgula, tudo entre aspas.
export const buildReportCsv = (results) => {
  // Célula começando com = + - @ vira fórmula no Excel: prefixa apóstrofo.
  const esc = (v) => {
    const s = String(v ?? '');
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const lines = [['linha', 'nome', 'resultado', 'motivo', 'avisos'].map(esc).join(';')];
  (results || []).forEach(({ c, cls }) => {
    lines.push([c.rowNumber, c.name, OUTCOME_LABEL[cls.outcome] || cls.outcome, cls.reason || '', (c.warnings || []).join(' | ')].map(esc).join(';'));
  });
  return `\uFEFF${lines.join('\r\n')}`;
};
