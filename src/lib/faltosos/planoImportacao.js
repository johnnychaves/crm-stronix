// O plano da importação dos relatórios da Next Fit: recebe tudo o que foi
// lido (as linhas dos arquivos, o estado de cada aluno, as presenças guardadas
// dos meses do arquivo, os clientes, as ligações e a configuração) e devolve
// tudo o que será gravado, mais a prévia e os avisos. Puro: nada é gravado
// aqui, e a tela roda o plano de novo a cada escolha do passo curto e a cada
// ligação feita à mão. A gravação (gravarImportacao.js) relê os estados e roda
// o plano mais uma vez logo antes de gravar.
//
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md
// ("As importações", "Marcos e tarefas", "Urgente", "A prévia", "A gravação").
import { dataDoFaltantes, nomeChave, periodoDasPresencas } from './nextfitArquivos.js';
import {
  clienteProvavel, indiceDeClientes, ligarFaltantes, ligarPresencas, nomesManuais, nomesParaGuardar,
} from './ligacaoAlunos.js';
import { normalizarProfessorLinks, professorDaLinha, professoresNovos } from './ligacaoProfessores.js';
import {
  JANELA_DA_PRIMEIRA_IMPORTACAO, marcoAlcancado, marcoAtravessado, normalizarJanelaUrgente, normalizarMarcos,
} from './marcos.js';
import { situacaoDoContrato, urgenteDe } from './urgente.js';
import { normalizarUltimaImportacao, periodoOuNull } from './configFaltosos.js';
import { ddmm, ddmmaaaa, diaValido, diasEntre, hojeEmBrasilia, maiorDia, mesDoDia, somarDias } from './dias.js';

export const STATUS = Object.freeze({ FALTANDO: 'faltando', VOLTOU: 'voltou', ENCERRADO: 'encerrado' });
export const TAREFA = Object.freeze({ PENDENTE: 'pendente', FEITA: 'feita', VOLTOU: 'voltou', ENCERRADA: 'encerrada' });

// Buraco no Presenças: mais de 2 dias entre o último dia já importado e o
// primeiro dia do arquivo novo.
export const LIMITE_DO_BURACO = 2;
// Filtro maior: ninguém com até 3 dias além do menor marco, e mais de 20% dos
// faltosos da importação anterior fora do arquivo.
export const FOLGA_DO_FILTRO = 3;
export const PARCELA_QUE_SUMIU = 0.2;

export const MENSAGENS = Object.freeze({
  semArquivo: 'Escolha o relatório Faltantes, o Presenças ou os dois.',
  faltantesSemData: 'Nenhuma linha do Faltantes tem a última presença e a quantidade de ausências legíveis. Confira se é o relatório Faltantes da Next Fit.',
  presencasSemData: 'Nenhuma linha do Presenças tem o cliente, o tipo e a data legíveis. Confira se é o relatório Presenças da Next Fit.',
  faltantesAntigo: (e, ultimo) => `Este Faltantes é de ${ddmmaaaa(e)}, mais antigo que o último importado, de ${ddmmaaaa(ultimo)}. Exporte o relatório de hoje.`,
  datasDivergentes: (n, e) => `Em ${n} ${n === 1 ? 'linha' : 'linhas'} do Faltantes, a última presença mais as ausências não dá ${ddmm(e)}. Valeu ${ddmm(e)}, o dia da maioria das linhas.`,
  filtroMaior: ({ menor, sumiram, anteriores, viramVoltou }) => `O Faltantes parece ter saído com um filtro maior que ${menor} dias: ninguém aparece com até ${menor + FOLGA_DO_FILTRO} dias sem vir, e ${sumiram} dos ${anteriores} faltosos da importação anterior sumiram dele. Se seguir, ${viramVoltou} ${viramVoltou === 1 ? 'vai ser marcado' : 'vão ser marcados'} como "voltou". Exporte de novo com ${menor} dias.`,
  buracoPresencas: (ultimo, primeiro) => `O último Presenças importado vai até ${ddmm(ultimo)}, e este começa em ${ddmm(primeiro)}. Os dias entre eles podem ter ficado sem presença. Exporte o Presenças a partir de ${ddmm(somarDias(ultimo, 1))}.`,
});

const objeto = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const diaOuNull = (v) => (diaValido(v) ? v : null);

// E0: o Faltantes anterior. Na mesma data de novo, o E0 que ela usou, para a
// mesma data chegar ao mesmo resultado. Na primeira importação, E menos 7 dias.
export function e0Da(e, ultima) {
  const u = normalizarUltimaImportacao(ultima);
  if (u?.dataFaltantes && e > u.dataFaltantes) return u.dataFaltantes;
  if (u?.dataFaltantes && e === u.dataFaltantes && u.dataFaltantesAnterior && u.dataFaltantesAnterior < e) return u.dataFaltantesAnterior;
  return somarDias(e, -JANELA_DA_PRIMEIRA_IMPORTACAO);
}

// Id fixo da importação, tirado das datas dos arquivos: "f2026-10-06",
// "p2026-09-29_2026-10-05" ou os dois juntos. Os mesmos arquivos de novo caem
// no mesmo registro e deixam nos alunos o mesmo carimbo. null sem arquivo.
export function idDaImportacao({ dataFaltantes = null, periodoPresencas = null } = {}) {
  const partes = [];
  if (diaValido(dataFaltantes)) partes.push(`f${dataFaltantes}`);
  const p = periodoOuNull(periodoPresencas);
  if (p) partes.push(`p${p.de}_${p.ate}`);
  return partes.length ? partes.join('_') : null;
}

// Id fixo da linha "Voltou a treinar" em stronix_interactions: uma por aluno
// e período de falta, que se reconhece pela última presença que o abriu.
export const idDaVolta = (leadId, inicioFalta) => `volta_${leadId}_${inicioFalta}`;

// "Voltou a treinar em 03/10", com o dia, ou "Voltou a treinar entre 26/09 e
// 06/10", sem ele.
export function textoDaVolta({ voltouEm = null, voltouEntre = null } = {}) {
  if (diaValido(voltouEm)) return `Voltou a treinar em ${ddmm(voltouEm)}`;
  if (voltouEntre) return `Voltou a treinar entre ${ddmm(voltouEntre.de)} e ${ddmm(voltouEntre.ate)}`;
  return 'Voltou a treinar';
}

// Comparação de valores gravados: null e ausente contam igual, Timestamp e
// Date pelo instante.
function iguais(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a.toMillis === 'function' && typeof b.toMillis === 'function') return a.toMillis() === b.toMillis();
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => iguais(x, b[i]));
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of chaves) if (!iguais(a[k] ?? null, b[k] ?? null)) return false;
  return true;
}

const menorHora = (a, b) => (a && b ? (a < b ? a : b) : a || b || null);
const ordenar = (lista) => [...lista].sort((x, y) => String(x).localeCompare(String(y), 'pt-BR'));

// leadId → Map(dia → { hora, origens: Set, modalidades: Set }), das linhas
// do Presenças ligadas.
function presencasPorAluno(ligados) {
  const porLead = new Map();
  for (const { linha, leadId } of ligados) {
    if (!diaValido(linha?.dia)) continue;
    if (!porLead.has(leadId)) porLead.set(leadId, new Map());
    const dias = porLead.get(leadId);
    const dia = dias.get(linha.dia) || { hora: null, origens: new Set(), modalidades: new Set() };
    dia.hora = menorHora(dia.hora, linha.hora);
    if (linha.origem) dia.origens.add(linha.origem);
    if (linha.modalidade) dia.modalidades.add(linha.modalidade);
    dias.set(linha.dia, dia);
  }
  return porLead;
}

// O primeiro dia de presença depois de `dia` (e até `ate`, quando dado).
function primeiraPresencaDepois(dias, dia, ate = null) {
  let achou = null;
  for (const d of dias?.keys() || []) {
    if (d > dia && (ate === null || d <= ate) && (achou === null || d < achou)) achou = d;
  }
  return achou;
}

// O último dia de presença até `ate`, inclusive.
function ultimaPresencaAte(dias, ate) {
  let achou = null;
  for (const d of dias?.keys() || []) if (d <= ate && (achou === null || d > achou)) achou = d;
  return achou;
}

// Volta entre o dia seguinte à última presença e `ate`. Um dia só vira o dia
// exato.
function voltaEntre(inicioFalta, ate) {
  const de = somarDias(inicioFalta, 1);
  return de >= ate ? { voltouEm: ate, voltouEntre: null } : { voltouEm: null, voltouEntre: { de, ate } };
}

const fecharTarefa = (tarefa, status) => (tarefa?.status === TAREFA.PENDENTE ? { ...tarefa, status } : (tarefa ?? null));

function fecharComoVolta(atual, { voltouEm, voltouEntre }, ultimaPresenca, importacaoId) {
  return {
    ...atual,
    status: STATUS.VOLTOU,
    voltouEm: voltouEm ?? null,
    voltouEntre: voltouEntre ?? null,
    ultimaPresenca: maiorDia(atual.ultimaPresenca, ultimaPresenca) || atual.ultimaPresenca || null,
    urgente: false,
    atualizadoNaImportacao: importacaoId,
    tarefa: fecharTarefa(atual.tarefa, TAREFA.VOLTOU),
  };
}

function fecharComoEncerrado(atual, importacaoId) {
  return {
    ...atual,
    status: STATUS.ENCERRADO,
    urgente: false,
    atualizadoNaImportacao: importacaoId,
    tarefa: fecharTarefa(atual.tarefa, TAREFA.ENCERRADA),
  };
}

// A tarefa do período depois dos marcos e do urgente. Devolve a tarefa, o
// marco em que o aluno entrou nesta importação (tarefa criada ou que trocou
// de marco) e se o urgente criou a tarefa ou deu o selo a ela. A tarefa é do
// período quando o inicioFalta dela é o do estado: a de um período anterior,
// mesmo fechada, não segura a tarefa do período novo.
//
// - Atravessou um ou mais marcos: a tarefa passa a ser do maior. A pendente
//   troca de marco no mesmo card (fica o criadaEm, troca o importacaoId); a
//   já fechada dá lugar a uma nova.
// - Não atravessou nenhum: nada muda.
// - Urgente: uma tarefa por período, mesmo depois do último marco. A pendente
//   ganha o selo; se a do período já foi fechada sem ser urgente, nasce outra.
//   O selo nunca sai de uma tarefa: é ele que guarda o "uma vez por período".
function tarefaDoPeriodo({ tarefa, inicioFalta, marcoNovo, urgente, marcoDoUrgente, hojeDia, importacaoId }) {
  const nova = (marco, urg) => ({
    marco, urgente: urg, status: TAREFA.PENDENTE, inicioFalta, criadaEm: hojeDia, importacaoId,
    feitaEm: null, feitaPor: null, feitaPorNome: null, canal: null, resultado: null,
  });
  const doPeriodo = (t) => (t && t.inicioFalta === inicioFalta ? t : null);
  let resultado = tarefa ?? null;
  let entrouNoMarco = null;
  let urgenteNovo = false;
  if (marcoNovo !== null) {
    const t = doPeriodo(resultado);
    if (!t || (t.status !== TAREFA.PENDENTE && (t.marco ?? 0) < marcoNovo)) {
      resultado = nova(marcoNovo, urgente);
      entrouNoMarco = marcoNovo;
      urgenteNovo = urgente;
    } else if (t.status === TAREFA.PENDENTE && (t.marco ?? 0) < marcoNovo) {
      resultado = { ...t, marco: marcoNovo, urgente: Boolean(t.urgente || urgente), importacaoId };
      entrouNoMarco = marcoNovo;
      urgenteNovo = urgente && !t.urgente;
    }
  }
  if (urgente) {
    const t = doPeriodo(resultado);
    if (!t) {
      resultado = nova(marcoDoUrgente, true);
      urgenteNovo = true;
    } else if (!t.urgente) {
      resultado = t.status === TAREFA.PENDENTE ? { ...t, urgente: true } : nova(marcoDoUrgente, true);
      urgenteNovo = true;
    }
  }
  return { tarefa: resultado, entrouNoMarco, urgenteNovo };
}

const tarefaPendente = (d) => d?.tarefa?.status === TAREFA.PENDENTE && d.tarefa.inicioFalta === d.inicioFalta;

// Presenças por dia, juntas com os meses já guardados: o mesmo dia conta uma
// vez, fica a hora menor e as origens e modalidades se somam, em ordem. O doc
// devolvido é o mês inteiro (os dias guardados mais os do arquivo), e só o mês
// que muda é devolvido.
function juntarPresencas(diasPorLead, presencasAtuais) {
  const presencasPorDoc = [];
  let diasDePresenca = 0;
  for (const [leadId, dias] of [...diasPorLead].sort(([a], [b]) => a.localeCompare(b))) {
    const porMes = new Map();
    for (const [dia, info] of dias) {
      const mes = mesDoDia(dia);
      if (!porMes.has(mes)) porMes.set(mes, []);
      porMes.get(mes).push([dia, info]);
      diasDePresenca += 1;
    }
    for (const [mes, lista] of [...porMes].sort(([a], [b]) => a.localeCompare(b))) {
      const id = `${leadId}_${mes}`;
      const guardado = objeto(presencasAtuais?.[id]);
      const diasGuardados = objeto(guardado?.dias) || {};
      const juntos = { ...diasGuardados };
      for (const [dia, info] of lista) {
        const antes = objeto(diasGuardados[dia]);
        juntos[dia] = {
          hora: menorHora(antes?.hora || null, info.hora),
          origens: ordenar(new Set([...(Array.isArray(antes?.origens) ? antes.origens : []), ...info.origens])),
          modalidades: ordenar(new Set([...(Array.isArray(antes?.modalidades) ? antes.modalidades : []), ...info.modalidades])),
        };
      }
      const doc = { leadId, mes, dias: juntos };
      if (!guardado || !iguais(doc, { leadId: guardado.leadId, mes: guardado.mes, dias: guardado.dias })) presencasPorDoc.push({ id, doc });
    }
  }
  return { presencasPorDoc, diasDePresenca };
}

// Nomes da Next Fit a gravar em stronix_nextfit_alunos: os que mudam.
function nomesAGravar(novos, guardados) {
  const out = [];
  for (const [id, doc] of Object.entries(novos).sort(([a], [b]) => a.localeCompare(b))) {
    const g = objeto(guardados[id]);
    if (!g || !iguais({ nomeNextFit: g.nomeNextFit, leadIds: g.leadIds, origem: g.origem }, doc)) out.push({ id, doc });
  }
  return out;
}

// Os avisos da prévia: datas do Faltantes que não batem, filtro maior e
// buraco no Presenças.
function avisosDaImportacao({ E, divergentes, marcos, linhasF, estadosLidos, sumiram, finais, periodo, ultima }) {
  const avisos = [];
  if (E && divergentes > 0) {
    avisos.push({ codigo: 'datas_divergentes', mensagem: MENSAGENS.datasDivergentes(divergentes, E), divergentes });
  }
  if (E) {
    const menor = marcos[0];
    const anteriores = Object.keys(estadosLidos).filter((id) => estadosLidos[id]?.status === STATUS.FALTANDO).length;
    const ninguemPerto = !linhasF.some((l) => l.ausencias <= menor + FOLGA_DO_FILTRO);
    if (ninguemPerto && anteriores > 0 && sumiram.length > anteriores * PARCELA_QUE_SUMIU) {
      const viramVoltou = sumiram.filter((id) => finais.get(id)?.status === STATUS.VOLTOU).length;
      avisos.push({
        codigo: 'filtro_maior',
        mensagem: MENSAGENS.filtroMaior({ menor, sumiram: sumiram.length, anteriores, viramVoltou }),
        sumiram: sumiram.length,
        anteriores,
        viramVoltou,
      });
    }
  }
  const ultimoDia = ultima?.ultimoDiaPresencas || null;
  if (periodo && ultimoDia && diasEntre(ultimoDia, periodo.de) > LIMITE_DO_BURACO) {
    avisos.push({
      codigo: 'buraco_presencas',
      mensagem: MENSAGENS.buracoPresencas(ultimoDia, periodo.de),
      ultimoDia,
      primeiroDia: periodo.de,
    });
  }
  return avisos;
}

// Quanto fica com cada professor depois da importação; "Sem professor" por
// último.
function porProfessorDe(faltando, professores) {
  const nomeDoProfessor = (id) => (professores || []).find((p) => p?.id === id)?.nome || null;
  const mapa = new Map();
  for (const d of faltando) {
    const k = d.professorId || null;
    const item = mapa.get(k) || { professorId: k, nome: k ? nomeDoProfessor(k) : null, alunos: 0, pendentes: 0, urgentes: 0 };
    item.alunos += 1;
    if (tarefaPendente(d)) item.pendentes += 1;
    if (d.urgente) item.urgentes += 1;
    mapa.set(k, item);
  }
  return [...mapa.values()].sort((a, b) => (a.professorId === null) - (b.professorId === null)
    || b.alunos - a.alunos || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

// A linha do Faltantes como a prévia mostra.
const daLinha = (l) => ({
  numero: l.numero, nome: l.nome, telefone: l.telefone, professorNextFit: l.professorNextFit,
  ultimaPresenca: l.ultimaPresenca, ausencias: l.ausencias,
});

// Os não ligados e os ambíguos, para a prévia ligar à mão. No Faltantes, uma
// linha por aluno, com o telefone e, no não ligado, a sugestão (o cliente
// provável, quando é um só). No Presenças, um item por nome, com quantas
// linhas ele tem no arquivo.
function listasDeLigacao({ lf, lp, indice, nomesBase }) {
  const candidatosDe = (lista) => lista.map((id) => ({ leadId: id, nome: indice.porId.get(id)?.name || null }));
  const porNome = (linhas, extra = () => ({})) => {
    const m = new Map();
    linhas.forEach((linha, i) => {
      const k = nomeChave(linha.nome);
      const item = m.get(k);
      if (item) item.linhas += 1;
      else m.set(k, { nome: linha.nome, linhas: 1, ...extra(i) });
    });
    return [...m.values()];
  };
  return {
    naoLigadosF: lf.naoLigados.map((l) => ({ ...daLinha(l), sugestao: clienteProvavel(l, indice, nomesBase) })),
    ambiguosF: lf.ambiguos.map(({ linha, candidatos }) => ({ ...daLinha(linha), candidatos: candidatosDe(candidatos) })),
    naoLigadosP: porNome(lp.naoLigados),
    ambiguosP: porNome(lp.ambiguos.map((a) => a.linha), (i) => ({ candidatos: candidatosDe(lp.ambiguos[i].candidatos) })),
  };
}

// O resumo da última importação depois desta, que a gravação junta com
// importadoEm e importadoPorNome. A importação de um arquivo só repete o valor
// do outro; entre dois Presenças, fica o que termina depois.
function ultimaImportacaoDepois({ ultima, importacaoId, E, e0, periodo }) {
  const anterior = ultima?.periodoPresencas || null;
  const periodoPresencas = periodo && (!anterior || periodo.ate >= anterior.ate) ? periodo : anterior;
  return {
    id: importacaoId,
    dataFaltantes: E || ultima?.dataFaltantes || null,
    dataFaltantesAnterior: E ? e0 : (ultima?.dataFaltantesAnterior || null),
    periodoPresencas,
    ultimoDiaPresencas: maiorDia(ultima?.ultimoDiaPresencas, periodo?.ate),
  };
}

// O plano. Entrada:
// - faltantes e presencas: o que parseFaltantes e parsePresencas devolvem, ou null;
// - estadosAtuais: { [leadId]: doc de stronix_faltosos }, todos os documentos;
// - presencasAtuais: { [leadId_AAAA-MM]: doc de stronix_presencas } dos meses do
//   arquivo (a tela lê por where('mes', 'in', meses));
// - clientes: os leads com lifecycleBucket 'cliente';
// - professores: o cadastro de professores (sugestão e nomes da prévia);
// - ligacoes: { professores: professorLinks já com as escolhas do passo curto,
//   alunos: { [nomeChave]: doc de stronix_nextfit_alunos }, manuais:
//   [{ nomeNextFit, leadId }] feitas na prévia };
// - config: stronix_config/faltosos, cru ou já lido por normalizarConfigFaltosos;
// - ultimaImportacao: opcional; sem ele, config.ultimaImportacao;
// - agora: o instante da importação.
export function planejarImportacao({
  faltantes = null,
  presencas = null,
  estadosAtuais = {},
  presencasAtuais = {},
  clientes = [],
  professores = [],
  ligacoes = {},
  config = {},
  ultimaImportacao,
  agora = new Date(),
} = {}) {
  const vazio = {
    recusa: null, prontoParaGravar: false, pendencias: { professoresNovos: [] }, importacao: null,
    estados: [], voltas: [], voltasDesfeitas: [], presencasPorDoc: [], nomesAlunos: [],
    config: null, registro: null, previa: null, avisos: [],
  };
  const recusar = (codigo, mensagem) => ({ ...vazio, recusa: { codigo, mensagem } });
  if (!faltantes && !presencas) return recusar('sem_arquivo', MENSAGENS.semArquivo);

  const marcos = normalizarMarcos(config?.marcos);
  const janela = normalizarJanelaUrgente(config?.janelaUrgenteDias);
  const ultima = normalizarUltimaImportacao(ultimaImportacao ?? config?.ultimaImportacao);
  const hojeDia = hojeEmBrasilia(agora);
  const linhasF = faltantes?.linhas || [];
  const linhasP = presencas?.linhas || [];
  const estadosLidos = objeto(estadosAtuais) || {};

  // A data do Faltantes, e a recusa do Faltantes mais antigo que o último.
  let E = null;
  let divergentes = 0;
  if (faltantes) {
    ({ dia: E, divergentes } = dataDoFaltantes(linhasF));
    if (!E) return recusar('faltantes_sem_data', MENSAGENS.faltantesSemData);
    if (ultima?.dataFaltantes && E < ultima.dataFaltantes) {
      return recusar('faltantes_antigo', MENSAGENS.faltantesAntigo(E, ultima.dataFaltantes));
    }
  }
  const periodo = periodoDasPresencas(linhasP);
  if (!E && !periodo) return recusar('presencas_sem_data', MENSAGENS.presencasSemData);
  const e0 = E ? e0Da(E, ultima) : null;
  const importacaoId = idDaImportacao({ dataFaltantes: E, periodoPresencas: periodo });

  // A ligação dos alunos: o Faltantes primeiro, porque os nomes que ele liga
  // pelo telefone já valem para o Presenças da mesma importação.
  const indice = indiceDeClientes(clientes);
  const guardados = objeto(ligacoes?.alunos) || {};
  const manuais = nomesManuais(ligacoes?.manuais);
  const nomesBase = { ...guardados, ...manuais };
  const lf = ligarFaltantes(linhasF, indice, nomesBase);
  const nomesTelefone = nomesParaGuardar(lf.ligados, nomesBase, indice);
  const lp = ligarPresencas(linhasP, indice, { ...nomesBase, ...nomesTelefone });

  // A ligação dos professores.
  const links = normalizarProfessorLinks(ligacoes?.professores ?? config?.professorLinks);
  const pendentesDeProfessor = professoresNovos(linhasF, links, professores);

  // Uma linha do Faltantes por aluno (a da presença mais nova, se repetir). A
  // linha com a última presença depois de E não bate com o arquivo (entra no
  // aviso das datas) e fica fora do estado.
  const faltantesPorLead = new Map();
  let duplicados = 0;
  for (const { linha, leadId } of lf.ligados) {
    if (linha.ultimaPresenca > E) continue;
    const antes = faltantesPorLead.get(leadId);
    if (antes) duplicados += 1;
    if (!antes || linha.ultimaPresenca > antes.ultimaPresenca) faltantesPorLead.set(leadId, linha);
  }
  const diasPorLead = presencasPorAluno(lp.ligados);

  // O cliente provável de cada linha do Faltantes que não ligou (sem par ou
  // ambígua). O aluno faltando cujo nome está numa dessas linhas não é marcado
  // como "voltou": o telefone dele pode ter mudado no Stronilead.
  const provavelPorLead = new Map();
  for (const linha of [...lf.naoLigados, ...lf.ambiguos.map((a) => a.linha)]) {
    const leadId = clienteProvavel(linha, indice, nomesBase);
    if (leadId && !provavelPorLead.has(leadId)) provavelPorLead.set(leadId, linha);
  }

  const estados = [];
  const voltas = [];
  const voltasDesfeitas = [];
  const finais = new Map();
  const voltaram = [];
  const encerrados = [];
  const foraSemContrato = [];
  const provaveis = [];
  const entramNoMarco = Object.fromEntries(marcos.map((m) => [String(m), 0]));
  let urgentesNovos = 0;
  const sumiram = [];

  const nomeDe = (leadId, linha) => indice.porId.get(leadId)?.name || linha?.nome || null;
  // Uma linha de volta por aluno em cada importação, a do período mais
  // recente. O aluno que voltou, sumiu de novo e voltou outra vez entre duas
  // importações passa aqui duas vezes, uma logo depois da outra (os alunos são
  // vistos um por vez), e a segunda volta troca a primeira. A gravação recusa
  // o plano com duas voltas do mesmo aluno.
  const registrarVolta = (leadId, inicioFalta, volta) => {
    const lead = indice.porId.get(leadId) || null;
    if (voltas.at(-1)?.leadId === leadId) {
      voltas.pop();
      voltaram.pop();
    }
    voltas.push({
      id: idDaVolta(leadId, inicioFalta),
      leadId,
      inicioFalta,
      voltouEm: volta.voltouEm ?? null,
      voltouEntre: volta.voltouEntre ?? null,
      text: textoDaVolta(volta),
      importacaoId,
      lead: {
        id: leadId,
        name: lead?.name || null,
        consultantId: lead?.consultantId || null,
        consultantAuthUid: lead?.consultantAuthUid || null,
      },
    });
    voltaram.push({ leadId, nome: nomeDe(leadId), voltouEm: volta.voltouEm ?? null, voltouEntre: volta.voltouEntre ?? null });
  };

  const ids = new Set([
    ...faltantesPorLead.keys(),
    ...Object.keys(estadosLidos).filter((id) => estadosLidos[id]?.status === STATUS.FALTANDO),
  ]);

  for (const leadId of [...ids].sort()) {
    const atual = objeto(estadosLidos[leadId]);
    const lead = indice.porId.get(leadId) || null;
    const linha = faltantesPorLead.get(leadId) || null;
    const dias = diasPorLead.get(leadId) || null;
    let novo = atual;

    if (linha) {
      // O aluno está no Faltantes.
      const situacao = lead ? situacaoDoContrato(lead, agora) : 'sem_contrato_ativo';
      if (situacao !== 'ativo') {
        foraSemContrato.push({ leadId, nome: nomeDe(leadId, linha), motivo: situacao });
        if (atual?.status === STATUS.FALTANDO) {
          novo = fecharComoEncerrado(atual, importacaoId);
          encerrados.push({ leadId, nome: nomeDe(leadId, linha) });
        }
      } else if (atual && atual.status !== STATUS.FALTANDO && diaValido(atual.ultimaPresenca) && atual.ultimaPresenca > E) {
        // Já se sabe de uma presença depois da data do Faltantes: ele ficou
        // para trás para esse aluno, e nada muda.
      } else {
        // A última presença conhecida até E: a do Faltantes, a do Presenças e a
        // guardada. Se o Presenças mostra presença depois da do Faltantes, ele
        // vale (a presença aconteceu, como a da agenda que o Faltantes não vê).
        const guardada = diaValido(atual?.ultimaPresenca) && atual.ultimaPresenca <= E ? atual.ultimaPresenca : null;
        const x = maiorDia(linha.ultimaPresenca, ultimaPresencaAte(dias, E), guardada);
        const inicioAtual = diaOuNull(atual?.inicioFalta);
        const professorId = professorDaLinha(linha.professorNextFit, links) ?? null;
        const { urgente, contratoTerminaEm } = urgenteDe(lead, agora, janela);
        const camposDaLinha = {
          leadId,
          professorId,
          professorNextFit: linha.professorNextFit || null,
          contratoNextFit: linha.contrato || null,
          urgente,
          contratoTerminaEm,
          atualizadoNaImportacao: importacaoId,
        };
        let periodoAberto = false;
        if (!atual || !inicioAtual || x > inicioAtual) {
          // Período novo. O de antes, se estava aberto, fechou: o aluno veio
          // em x ou antes.
          let base = atual;
          if (atual?.status === STATUS.FALTANDO && inicioAtual) {
            const dia = primeiraPresencaDepois(dias, inicioAtual, x);
            const volta = dia ? { voltouEm: dia, voltouEntre: null } : voltaEntre(inicioAtual, x);
            base = fecharComoVolta(atual, volta, x, importacaoId);
            registrarVolta(leadId, inicioAtual, volta);
          }
          const contradito = x > linha.ultimaPresenca;
          if (contradito && diasEntre(x, E) < marcos[0]) {
            // As presenças mostram que ele está vindo: nenhum período abre.
            novo = base ? { ...base, ultimaPresenca: maiorDia(base.ultimaPresenca, x) } : null;
          } else {
            novo = {
              ...(base || {}),
              ...camposDaLinha,
              ultimaPresenca: x,
              inicioFalta: x,
              status: STATUS.FALTANDO,
              voltouEm: null,
              voltouEntre: null,
              diasNaImportacao: diasEntre(x, E),
              querCancelarEm: base?.querCancelarEm ?? null,
              tarefa: base?.tarefa ?? null,
            };
            periodoAberto = true;
          }
        } else if (x === inicioAtual) {
          // Mesma última presença: o mesmo período continua. Se ele tinha
          // saído como "voltou" (só pode ter sido sem dia, porque a volta com
          // dia move a última presença), a volta não aconteceu e a linha sai.
          if (atual.status === STATUS.VOLTOU) {
            voltasDesfeitas.push(idDaVolta(leadId, inicioAtual));
          }
          novo = {
            ...atual,
            ...camposDaLinha,
            ultimaPresenca: x,
            status: STATUS.FALTANDO,
            voltouEm: null,
            voltouEntre: null,
            diasNaImportacao: diasEntre(x, E),
            querCancelarEm: atual.querCancelarEm ?? null,
            tarefa: atual.tarefa ?? null,
          };
          periodoAberto = true;
        }
        // x antes do início guardado não acontece: a guardada entra em x.

        if (periodoAberto) {
          const depois = primeiraPresencaDepois(dias, novo.inicioFalta);
          if (depois) {
            // Voltou depois da data do Faltantes, no Presenças desta importação.
            const volta = { voltouEm: depois, voltouEntre: null };
            registrarVolta(leadId, novo.inicioFalta, volta);
            novo = fecharComoVolta(novo, volta, maiorDia(...dias.keys()), importacaoId);
          } else {
            const r = tarefaDoPeriodo({
              tarefa: novo.tarefa,
              inicioFalta: novo.inicioFalta,
              marcoNovo: marcoAtravessado({ ultimaPresenca: novo.inicioFalta, e0, e: E, marcos }),
              urgente,
              marcoDoUrgente: marcoAlcancado({ ultimaPresenca: novo.inicioFalta, e: E, marcos }),
              hojeDia,
              importacaoId,
            });
            novo = { ...novo, tarefa: r.tarefa };
            if (r.entrouNoMarco !== null) entramNoMarco[String(r.entrouNoMarco)] += 1;
            if (r.urgenteNovo) urgentesNovos += 1;
          }
        }
      }
    } else if (atual?.status === STATUS.FALTANDO && diaValido(atual.inicioFalta)) {
      // O aluno estava faltando e não está no Faltantes (ou não veio Faltantes).
      const dia = primeiraPresencaDepois(dias, atual.inicioFalta);
      if (dia) {
        if (E) sumiram.push(leadId);
        const volta = { voltouEm: dia, voltouEntre: null };
        registrarVolta(leadId, atual.inicioFalta, volta);
        novo = fecharComoVolta(atual, volta, maiorDia(...dias.keys()), importacaoId);
      } else if (E) {
        const situacao = lead ? situacaoDoContrato(lead, agora) : 'sem_contrato_ativo';
        if (situacao !== 'ativo') {
          sumiram.push(leadId);
          novo = fecharComoEncerrado(atual, importacaoId);
          encerrados.push({ leadId, nome: nomeDe(leadId) });
        } else if (provavelPorLead.has(leadId)) {
          // O nome dele está no Faltantes, numa linha que não ligou: continua
          // faltando como estava, e a prévia mostra a provável mesma pessoa
          // para a ligação ser feita à mão.
          provaveis.push({ leadId, nome: nomeDe(leadId), linha: daLinha(provavelPorLead.get(leadId)) });
        } else {
          sumiram.push(leadId);
          const volta = voltaEntre(atual.inicioFalta, E);
          registrarVolta(leadId, atual.inicioFalta, volta);
          novo = fecharComoVolta(atual, volta, null, importacaoId);
        }
      }
    }

    if (novo) finais.set(leadId, novo);
    if (novo && !iguais(novo, atual)) estados.push({ leadId, doc: novo });
  }

  // Estados que não passaram pelo laço continuam como estão.
  for (const [leadId, doc] of Object.entries(estadosLidos)) if (!finais.has(leadId) && objeto(doc)) finais.set(leadId, doc);

  const { presencasPorDoc, diasDePresenca } = juntarPresencas(diasPorLead, presencasAtuais);
  const nomesAlunos = nomesAGravar({ ...nomesTelefone, ...manuais }, guardados);
  const avisos = avisosDaImportacao({ E, divergentes, marcos, linhasF, estadosLidos, sumiram, finais, periodo, ultima });

  // Números e listas da prévia.
  const faltandoAgora = [...finais.values()].filter((d) => d?.status === STATUS.FALTANDO);
  const porProfessor = porProfessorDe(faltandoAgora, professores);
  const { naoLigadosF, ambiguosF, naoLigadosP, ambiguosP } = listasDeLigacao({ lf, lp, indice, nomesBase });

  const numeros = {
    linhasFaltantes: linhasF.length,
    linhasPresencas: linhasP.length,
    errosFaltantes: faltantes?.erros?.length || 0,
    errosPresencas: presencas?.erros?.length || 0,
    ligadosFaltantes: faltantesPorLead.size,
    naoLigadosFaltantes: naoLigadosF.length + ambiguosF.length,
    alunosNoPresencas: diasPorLead.size,
    naoLigadosPresencas: naoLigadosP.length + ambiguosP.length,
    duplicados,
    faltando: faltandoAgora.length,
    entramNoMarco,
    urgentes: faltandoAgora.filter((d) => d.urgente).length,
    urgentesNovos,
    tarefasPendentes: faltandoAgora.filter(tarefaPendente).length,
    acompanhamento: faltandoAgora.filter((d) => !tarefaPendente(d)).length,
    semProfessor: faltandoAgora.filter((d) => !d.professorId).length,
    // Alunos: cada aluno tem no máximo uma volta por importação (registrarVolta).
    voltaram: new Set(voltaram.map((v) => v.leadId)).size,
    encerrados: encerrados.length,
    foraSemContrato: foraSemContrato.length,
    provaveis: provaveis.length,
    diasDePresenca,
  };

  const previa = {
    dataFaltantes: E,
    dataFaltantesAnterior: e0,
    periodoPresencas: periodo,
    numeros,
    porProfessor,
    listas: {
      professoresNovos: pendentesDeProfessor,
      naoLigados: { faltantes: naoLigadosF, presencas: naoLigadosP },
      ambiguos: { faltantes: ambiguosF, presencas: ambiguosP },
      foraSemContrato,
      voltaram,
      encerrados,
      provaveis,
      erros: { faltantes: faltantes?.erros || [], presencas: presencas?.erros || [] },
    },
  };

  const professorLinksMudou = !iguais(links, normalizarProfessorLinks(config?.professorLinks));
  return {
    recusa: null,
    prontoParaGravar: pendentesDeProfessor.length === 0,
    pendencias: { professoresNovos: pendentesDeProfessor },
    importacao: { id: importacaoId, dataFaltantes: E, dataFaltantesAnterior: e0, periodoPresencas: periodo },
    estados,
    voltas,
    voltasDesfeitas,
    presencasPorDoc,
    nomesAlunos,
    config: {
      ultimaImportacao: ultimaImportacaoDepois({ ultima, importacaoId, E, e0, periodo }),
      ...(professorLinksMudou ? { professorLinks: links } : {}),
    },
    registro: {
      dataFaltantes: E,
      dataFaltantesAnterior: e0,
      periodoPresencas: periodo,
      numeros,
      avisos: avisos.map(({ codigo, mensagem }) => ({ codigo, mensagem })),
      // Os "Não achados" da aba Faltosos, no formato do contrato: o nome, o
      // telefone (só o Faltantes tem) e de qual relatório veio. A prévia tem as
      // listas completas, para a ligação à mão.
      naoLigados: [
        ...[...naoLigadosF, ...ambiguosF].map(({ nome, telefone }) => ({ nome, telefone: telefone || null, relatorio: 'faltantes' })),
        ...[...naoLigadosP, ...ambiguosP].map(({ nome }) => ({ nome, telefone: null, relatorio: 'presencas' })),
      ],
    },
    previa,
    avisos,
  };
}
