// Os passos da importação das planilhas da Next Fit (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// importações" e "A prévia"). Puro, testado em node: o que cada arquivo é, a
// entrada do plano, os nomes novos de professor, a ligação feita à mão e os
// textos da prévia e dos erros. A janela
// (src/views/faltosos/importacao/ImportarPlanilhasDialog.jsx) lê o arquivo, lê
// a base e grava, pelos módulos de leitura e de gravação.
//
// Toda regra da importação mora no plano (planoImportacao.js). `entradaDoPlano`
// é o único lugar que monta a entrada dele: se o formato mudar, muda aqui e no
// teste deste arquivo, e a janela não muda.

import { dataDoFaltantes, detectReport, parseFaltantes, parsePresencas } from './nextfitArquivos.js';
import { planejarImportacao } from './planoImportacao.js';
import { nomeChave } from './ligacaoAlunos.js';
import { ERRO_OUTRA_IMPORTACAO } from './lotesImportacao.js';
import { ddmm, ddmmaaaa, mesDoDia } from './dias.js';

export const PASSOS = Object.freeze({
  ARQUIVOS: 'arquivos',
  LENDO: 'lendo',
  PROFESSORES: 'professores',
  PREVIA: 'previa',
  GRAVANDO: 'gravando',
  PRONTO: 'pronto',
});

// Valor do "Sem professor" na escolha do professor da Next Fit. Vira
// professorId null na ligação guardada.
export const SEM_PROFESSOR = '__sem_professor__';

// O texto da spec para o arquivo que não é nenhum dos dois relatórios.
export const RECUSA_ARQUIVO = 'Esse arquivo não é o relatório Faltantes nem o Presenças da Next Fit.';
export const RECUSA_ILEGIVEL = 'Não deu para ler esse arquivo. Exporte de novo da Next Fit, em Excel.';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// O que um arquivo lido é. Devolve o arquivo pronto para a tela, com as linhas
// e os erros do leitor, ou a recusa com o motivo.
// - Faltantes leva a data da exportação (última presença mais as ausências) e
//   quantas linhas não batem com ela.
// - Presenças leva o período: do primeiro ao último dia que aparece nele.
export function classificarArquivo({ nome, headers, rows }) {
  const tipo = detectReport(headers);
  if (!tipo) return { nome, recusa: RECUSA_ARQUIVO };
  if (tipo === 'faltantes') {
    const { linhas, erros } = parseFaltantes(rows);
    if (!linhas.length) return { nome, recusa: 'Esse Faltantes não tem nenhum aluno que deu para ler.' };
    const { dia, divergentes } = dataDoFaltantes(linhas);
    return { tipo, nome, linhas, erros: erros || [], dia: dia || null, divergentes: divergentes || 0 };
  }
  const { linhas, erros } = parsePresencas(rows);
  if (!linhas.length) return { nome, recusa: 'Esse Presenças não tem nenhuma presença que deu para ler.' };
  const dias = linhas.map((l) => l.dia).filter(Boolean).sort();
  return { tipo, nome, linhas, erros: erros || [], periodo: { de: dias[0], ate: dias[dias.length - 1] } };
}

// Cada tipo tem um lugar: o arquivo novo de um tipo troca o anterior do mesmo
// tipo, e a tela mostra qual ficou.
export const colocarArquivo = (arquivos, arquivo) => ({ ...arquivos, [arquivo.tipo]: arquivo });

// O resumo de cada arquivo na tela.
export function resumoDoArquivo(arquivo) {
  if (!arquivo) return '';
  if (arquivo.tipo === 'faltantes') {
    const data = arquivo.dia ? ` · exportado em ${ddmmaaaa(arquivo.dia)}` : '';
    return `${plural(arquivo.linhas.length, 'aluno', 'alunos')}${data}`;
  }
  const p = arquivo.periodo;
  return `${plural(arquivo.linhas.length, 'presença', 'presenças')} · de ${ddmm(p.de)} a ${ddmm(p.ate)}`;
}

// Os meses que o Presenças cobre, para ler as presenças já gravadas deles.
export function mesesDoPresencas(presencas) {
  if (!presencas) return [];
  return [...new Set((presencas.linhas || []).map((l) => mesDoDia(l.dia)).filter(Boolean))].sort();
}

// As escolhas do passo dos professores, a partir dos nomes novos do plano
// ({ nome, alunos, sugestao }): a sugestão já vem escolhida; sem ela, o campo
// fica vazio e segura o Continuar.
export const escolhasIniciais = (novos) => Object.fromEntries((novos || []).map((n) => [n.nome, n.sugestao || '']));

export const todosEscolhidos = (novos, escolhas) => (novos || []).every((n) => Boolean(escolhas?.[n.nome]));

// As escolhas no formato da ligação guardada ({ nome, professorId }), com
// "Sem professor" como null.
export function linksDasEscolhas(novos, escolhas) {
  return (novos || [])
    .filter((n) => escolhas?.[n.nome])
    .map((n) => ({ nome: n.nome, professorId: escolhas[n.nome] === SEM_PROFESSOR ? null : escolhas[n.nome] }));
}

// A ligação feita à mão na prévia, pela chave do nome na Next Fit (a mesma do
// documento em stronix_nextfit_alunos). Ligar de novo o mesmo nome troca a
// escolha.
export const ligarAMao = (manuais, item, leadId) => ({ ...manuais, [item.chave]: { nomeNextFit: item.nome, leadId } });

export function desfazerLigacao(manuais, chave) {
  const proximo = { ...manuais };
  delete proximo[chave];
  return proximo;
}

// A entrada do planejarImportacao (src/lib/faltosos/planoImportacao.js).
// - `base` é o que lerBaseDaImportacao leu; sem ela (antes da leitura), o
//   plano roda só com os arquivos e a configuração da tela, para dizer na hora
//   se o Faltantes é mais antigo que o último.
// - A configuração vai como está gravada (configDoc): o plano normaliza o que
//   usa, inclusive o E0 da mesma data importada de novo.
// - As ligações dos professores são as guardadas mais as escolhidas agora,
//   depois delas (a escolha de agora ganha).
export function entradaDoPlano({ arquivos, base = null, config = null, professores = [], novos = [], escolhas = {}, manuais = {}, agora }) {
  const f = arquivos?.faltantes;
  const p = arquivos?.presencas;
  const configDoc = base ? (base.configDoc || {}) : (config || {});
  const guardadas = Array.isArray(configDoc.professorLinks) ? configDoc.professorLinks : [];
  return {
    faltantes: f ? { linhas: f.linhas, erros: f.erros } : null,
    presencas: p ? { linhas: p.linhas, erros: p.erros } : null,
    estadosAtuais: base?.estadosAtuais || {},
    presencasAtuais: base?.presencasAtuais || {},
    clientes: base?.clientes || [],
    professores: professores || [],
    ligacoes: {
      professores: [...guardadas, ...linksDasEscolhas(novos, escolhas)],
      alunos: base?.nomesGuardados || {},
      manuais: Object.values(manuais || {}),
    },
    config: configDoc,
    agora,
  };
}

// A recusa que já dá para ver só com os arquivos e a configuração da tela, sem
// ler a base: o Faltantes mais antigo que o último importado. A regra e o
// texto são os do plano. Sem arquivo, nada a dizer.
export function recusaDosArquivos({ arquivos, config, agora }) {
  if (!arquivos?.faltantes && !arquivos?.presencas) return null;
  return planejarImportacao(entradaDoPlano({ arquivos, config, agora })).recusa || null;
}

// As datas da prévia numa linha: "Faltantes de 06/10/2026 · Presenças de 01/10
// a 06/10".
export function datasDaPrevia(previa) {
  const partes = [];
  if (previa?.dataFaltantes) partes.push(`Faltantes de ${ddmmaaaa(previa.dataFaltantes)}`);
  const p = previa?.periodoPresencas;
  if (p?.de && p?.ate) partes.push(`Presenças de ${ddmm(p.de)} a ${ddmm(p.ate)}`);
  return partes.join(' · ');
}

// Os números da prévia, na ordem da tela: quantos entram em cada marco,
// urgentes, voltaram, encerrados e quem segue só na lista de acompanhamento.
export function cartoesDaPrevia(previa) {
  const n = previa?.numeros || {};
  const porMarco = Object.entries(n.entramNoMarco || {})
    .map(([marco, alunos]) => ({ id: `marco-${marco}`, rotulo: `Entram no marco de ${marco} dias`, valor: alunos, tom: 'brand' }));
  return [
    ...porMarco,
    { id: 'urgentes', rotulo: 'Urgentes', valor: n.urgentes ?? 0, tom: 'rose', detalhe: n.urgentesNovos ? plural(n.urgentesNovos, 'novo', 'novos') : '' },
    { id: 'voltaram', rotulo: 'Voltaram', valor: n.voltaram ?? 0, tom: 'emerald' },
    { id: 'encerrados', rotulo: 'Encerrados', valor: n.encerrados ?? 0, tom: 'slate' },
    { id: 'acompanhamento', rotulo: 'Só acompanhamento', valor: n.acompanhamento ?? 0, tom: 'slate' },
  ];
}

// "12 dias de presença de 8 alunos entram na ficha." Sem Presenças, vazio.
export function linhaDasPresencas(previa) {
  const n = previa?.numeros || {};
  if (!n.diasDePresenca) return '';
  return `${plural(n.diasDePresenca, 'dia de presença', 'dias de presença')} de ${plural(n.alunosNoPresencas || 0, 'aluno', 'alunos')} entram na ficha.`;
}

// Os alunos que o plano não ligou, numa lista só, para a ligação à mão: os
// não ligados e os empates do Faltantes (com o telefone) e do Presenças (com
// quantas linhas). O mesmo nome nos dois arquivos aparece uma vez, com o
// telefone do Faltantes. `sugestao` é o cliente de um nome já guardado, o
// provável quando o telefone mudou no Stronilead.
export function alunosParaLigar(previa) {
  const l = previa?.listas || {};
  const porChave = new Map();
  const poe = (x, origem, candidatos = []) => {
    const nome = typeof x?.nome === 'string' ? x.nome.trim() : '';
    const chave = nomeChave(nome);
    if (!chave || porChave.has(chave)) return;
    porChave.set(chave, {
      chave,
      nome,
      telefone: origem === 'faltantes' ? (x.telefone || null) : null,
      origem,
      linhas: Number.isInteger(x.linhas) ? x.linhas : 1,
      sugestao: typeof x.sugestao === 'string' && x.sugestao ? x.sugestao : null,
      candidatos: (candidatos || []).filter((c) => c?.leadId),
    });
  };
  for (const x of l.naoLigados?.faltantes || []) poe(x, 'faltantes');
  for (const x of l.ambiguos?.faltantes || []) poe(x, 'faltantes', x.candidatos);
  for (const x of l.naoLigados?.presencas || []) poe(x, 'presencas');
  for (const x of l.ambiguos?.presencas || []) poe(x, 'presencas', x.candidatos);
  return [...porChave.values()];
}

// Quem voltou, com o dia ou o intervalo, como a linha do tempo vai dizer.
export function voltasDaPrevia(previa) {
  return (previa?.listas?.voltaram || []).map((v) => ({
    leadId: v.leadId,
    nome: v.nome || 'Cliente',
    quando: v.voltouEm
      ? `voltou em ${ddmm(v.voltouEm)}`
      : (v.voltouEntre ? `voltou entre ${ddmm(v.voltouEntre.de)} e ${ddmm(v.voltouEntre.ate)}` : 'voltou'),
  }));
}

// As linhas que os leitores deixaram de fora, com o arquivo e o número da
// linha na planilha.
export function linhasDeFora(previa) {
  const e = previa?.listas?.erros || {};
  return [
    ...(e.faltantes || []).map((x) => ({ arquivo: 'Faltantes', ...x })),
    ...(e.presencas || []).map((x) => ({ arquivo: 'Presenças', ...x })),
  ];
}

export const MOTIVO_FORA = Object.freeze({
  sem_contrato_ativo: 'Sem contrato ativo',
  trancado: 'Contrato trancado',
});

// O texto de cada aviso da prévia: o plano manda o texto pronto, com as datas;
// sem ele, vale o texto geral do código.
const TEXTO_DO_AVISO = Object.freeze({
  filtro_maior: 'O Faltantes parece ter saído com um filtro maior que o menor marco. Quem sumiu dele vai ser marcado como voltou.',
  datas_divergentes: 'As datas do Faltantes não batem entre si. Valeu o dia da maioria das linhas.',
  buraco_presencas: 'Entre o último Presenças importado e este passaram mais de 2 dias. Pode ter ficado um buraco.',
});
export const textoDoAviso = (aviso) => aviso?.mensagem || TEXTO_DO_AVISO[aviso?.codigo] || 'Confira os números antes de confirmar.';

export function mensagemDeErroDaLeitura(err) {
  if (err?.code === 'permission-denied') {
    return 'Sem permissão para ler os dados da importação. Confira se o módulo está ligado e se as regras novas foram publicadas.';
  }
  if (err?.code === 'unavailable') return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  return 'Não deu para ler os dados da academia. Tente de novo.';
}

// O que a janela diz quando a gravação não termina, e se dá para tentar de
// novo. `resultado` é o que gravarImportacao devolve; `lancado`, o erro que
// subiu (de um plano com defeito, ou da rede).
// - Outra importação gravada com a janela aberta: nada foi gravado, e tentar
//   de novo daria o mesmo erro. O texto é o da gravação.
// - Lote que falhou: os anteriores ficaram gravados, e tentar de novo com o
//   mesmo plano completa sem duplicar, porque os ids são fixos.
// - Leitura que falhou antes do primeiro lote: nada foi gravado.
// - Plano com defeito: nada foi gravado, e tentar de novo daria o mesmo erro.
export function falhaDaGravacao({ resultado = null, lancado = null } = {}) {
  const erro = lancado || resultado?.erro || null;
  if (erro?.code === ERRO_OUTRA_IMPORTACAO) {
    return { texto: erro.message, podeTentar: false };
  }
  if (erro?.code === 'permission-denied') {
    return { texto: 'O Firestore recusou a gravação. Confira se as regras novas foram publicadas.', podeTentar: true };
  }
  if (lancado) {
    if (lancado.code === 'unavailable') return { texto: 'Sem conexão com o servidor. Confira a internet e tente de novo.', podeTentar: true };
    return { texto: 'A importação não passou na conferência, e nada foi gravado. Feche a janela e importe de novo.', podeTentar: false };
  }
  if (Number.isInteger(resultado?.lote)) {
    return {
      texto: `A gravação parou no lote ${resultado.lote} de ${resultado.lotes}. O que entrou antes fica gravado. Tente de novo: nada se repete.`,
      podeTentar: true,
    };
  }
  return { texto: 'Não deu para ler o que já está gravado, e nada foi gravado. Confira a internet e tente de novo.', podeTentar: true };
}
