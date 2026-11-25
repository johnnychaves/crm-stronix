// Leitura do relatório de Presenças da Next Fit para a aderência (PR 6 do
// perfil do professor, plano 2026-11-25-perfil-do-professor-06-aderencia).
// Puro: o script scripts/import-presencas.js lê o arquivo e o banco e passa
// as linhas para cá. Cada linha é uma presença (ou falta) numa aula; a saída
// soma as presenças de cada CPF por semana (a segunda-feira, 'AAAA-MM-DD').
import { fromDateInputValue, toDateInputValue } from '../dates.js';

// Conferidos com o relatório "Presenças por contrato" de 25/11/2026 (colunas
// Cliente/Oportunidade, Grade, Tipo, Contrato, Instrutor, Local, Data inicial,
// Data final, Situação). Esse relatório não traz o CPF: ele vem da lista de
// clientes da Next Fit, pelo nome cadastrado lá (cpfPorNome).
export const APELIDOS = Object.freeze({
  cpf: ['cpf', 'cpf do cliente', 'documento'],
  data: ['data', 'data inicial', 'data da aula', 'data/hora', 'data e hora', 'dia', 'data da presença'],
  situacao: ['situação', 'situacao', 'status', 'presença', 'presenca'],
  modalidade: ['modalidade', 'atividade', 'aula', 'serviço', 'servico', 'agenda', 'grade'],
  nome: ['cliente/oportunidade', 'cliente', 'nome', 'nome do cliente', 'aluno'],
});
// Só "Presente" conta. Falta, Falta justificada, Desistente e Bloqueado, não.
const PRESENTE_RE = /^\s*presen/i;

const normal = (s) => String(s ?? '').trim().toLowerCase();

// Qual coluna é cada campo: { cpf, data, situacao, modalidade, nome }, com o
// nome da coluna como está no cabeçalho, ou null quando não existe.
export function colunasDoRelatorio(cabecalho) {
  const porNome = new Map((cabecalho || []).map((c) => [normal(c), c]));
  return Object.fromEntries(Object.entries(APELIDOS).map(([campo, nomes]) => [
    campo, nomes.map((n) => porNome.get(n)).find((c) => c !== undefined) ?? null,
  ]));
}

// Date local do dia da aula: Date (o SheetJS com cellDates), número de série
// do Excel ou texto "dd/mm/aaaa" (com ou sem hora). Null quando não é data.
export function diaDaAula(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) ? d : null;
}

// A segunda-feira da semana do dia, 'AAAA-MM-DD'.
export function semanaDe(dia) {
  const recuo = (dia.getDay() + 6) % 7;
  return toDateInputValue(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - recuo));
}

// As semanas inteiras (segunda a sexta) dentro de [de, ate], 'AAAA-MM-DD'.
export function semanasInteiras(de, ate) {
  const ini = fromDateInputValue(de);
  const fim = fromDateInputValue(ate);
  if (!ini || !fim || fim < ini) return [];
  const out = [];
  const seg = fromDateInputValue(semanaDe(ini));
  if (seg < ini) seg.setDate(seg.getDate() + 7);
  for (const d = seg; ; d.setDate(d.getDate() + 7)) {
    const sexta = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 4);
    if (sexta > fim) break;
    out.push(toDateInputValue(d));
  }
  return out;
}

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// O nome como chave: sem espaço nas pontas, espaços repetidos viram um e sem
// caixa. Os acentos ficam, para dois nomes diferentes não virarem um.
export const chaveDoNome = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Nome → CPF pela lista de clientes da Next Fit (colunas Nome e CPF). O nome
// que aparece com dois CPFs diferentes fica null: vai para as pendências.
export function cpfPorNome(clientes, { nome = 'Nome', cpf = 'CPF' } = {}) {
  const mapa = new Map();
  (clientes || []).forEach((c) => {
    const k = chaveDoNome(c[nome]);
    const d = soDigitos(c[cpf]);
    if (!k || d.length !== 11) return;
    if (mapa.has(k) && mapa.get(k) !== d) mapa.set(k, null);
    else if (!mapa.has(k)) mapa.set(k, d);
  });
  return mapa;
}

// Soma as presenças de cada CPF por semana. `linhas` são objetos com as chaves
// do cabeçalho. Devolve { contagem: Map('cpf_semana' → n), resumo, semCpf },
// em que semCpf são as linhas de presença sem CPF de 11 dígitos (para as
// pendências) e o resumo conta o que ficou fora e por quê.
// Sem coluna de CPF no relatório, o CPF vem de `cpfPorNome` (o mapa acima).
export function presencasDoRelatorio(linhas, colunas, { de, ate, modalidade = /funcional/i, cpfPorNome: porNome = null } = {}) {
  const semanas = new Set(semanasInteiras(de, ate));
  const contagem = new Map();
  const semCpf = [];
  const resumo = { linhas: 0, presencas: 0, falta: 0, outraModalidade: 0, fimDeSemana: 0, semData: 0, foraDoPeriodo: 0, semCpf: 0 };
  (linhas || []).forEach((l) => {
    resumo.linhas += 1;
    if (colunas.modalidade && !modalidade.test(String(l[colunas.modalidade] ?? ''))) { resumo.outraModalidade += 1; return; }
    if (colunas.situacao) {
      const s = String(l[colunas.situacao] ?? '');
      if (!PRESENTE_RE.test(s)) { resumo.falta += 1; return; }
    }
    const dia = diaDaAula(l[colunas.data]);
    if (!dia) { resumo.semData += 1; return; }
    if (dia.getDay() === 0 || dia.getDay() === 6) { resumo.fimDeSemana += 1; return; }
    const semana = semanaDe(dia);
    if (!semanas.has(semana)) { resumo.foraDoPeriodo += 1; return; }
    const cpf = colunas.cpf ? soDigitos(l[colunas.cpf]) : (porNome?.get(chaveDoNome(l[colunas.nome])) ?? '');
    if (cpf.length !== 11) { resumo.semCpf += 1; semCpf.push(l); return; }
    resumo.presencas += 1;
    const k = `${cpf}_${semana}`;
    contagem.set(k, (contagem.get(k) || 0) + 1);
  });
  return { contagem, resumo, semCpf, semanas: [...semanas] };
}

// Casa cada CPF com o lead da academia. `leads` são os leads com esses
// cpfDigits. Com mais de um, vale o cliente; se sobrar mais de um, é pendência.
// Devolve { registros: [{ leadId, semana, presencas }], semLead: [cpf], duplicados: [cpf] }.
// O aluno que não veio na semana não tem registro: a conta lê a falta de
// registro como nenhuma presença.
export function casarComLeads(contagem, leads) {
  const porCpf = new Map();
  (leads || []).forEach((l) => {
    const cpf = soDigitos(l.cpfDigits);
    if (cpf.length === 11) porCpf.set(cpf, [...(porCpf.get(cpf) || []), l]);
  });
  const escolhido = new Map();
  const semLead = new Set();
  const duplicados = new Set();
  const registros = [];
  contagem.forEach((presencas, k) => {
    const [cpf, semana] = k.split('_');
    if (!escolhido.has(cpf)) {
      const todos = porCpf.get(cpf) || [];
      const clientes = todos.filter((l) => l.lifecycleBucket === 'cliente');
      const lista = clientes.length ? clientes : todos;
      escolhido.set(cpf, lista.length === 1 ? lista[0].id : null);
      if (!todos.length) semLead.add(cpf);
      else if (lista.length > 1) duplicados.add(cpf);
    }
    const leadId = escolhido.get(cpf);
    if (leadId) registros.push({ leadId, semana, presencas });
  });
  return { registros, semLead: [...semLead], duplicados: [...duplicados] };
}
