// A forma das gravações da importação das planilhas da Next Fit: o documento
// de cada coleção, a linha "Voltou a treinar", a ordem e a divisão em lotes.
// O QUE muda em cada aluno vem do plano (planoImportacao.js); quem grava de
// verdade é o gravarImportacao.js. Spec em
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A
// gravação".
//
// Puro: nada de firebase.js aqui, para o teste rodar em node. A hora do
// servidor chega pronta em `carimbo` (o serverTimestamp() de quem grava), no
// molde do toSetupWrites (src/lib/funnelSetup.js). Cada gravação sai com o
// nome curto da coleção ('faltosos', 'presencas', 'interacoes', 'alunos',
// 'importacoes' e 'config', que é sempre o doc stronix_config/faltosos), e o
// gravarImportacao.js troca pelo caminho. Nenhuma gravação vai para o lead: a
// volta a treinar não é contato com a pessoa.

import { PRESENCE_RETURN_TYPE, getInteractionSecurityFields } from '../leads.js';
import { idDaImportacao, idDaVolta } from './planoImportacao.js';

// Gravações por lote, como a spec pede. A importação de clientes grava 450
// por lote (clientImportWrites.js) com as regras lendo os mesmos documentos
// em cada gravação, então o lote de 500 passa nas regras do mesmo jeito.
export const LIMITE_POR_LOTE = 500;

// Código do erro de quando outra importação foi gravada enquanto esta janela
// estava aberta. A tela mostra a mensagem do erro e pede para começar de novo.
export const ERRO_OUTRA_IMPORTACAO = 'outra-importacao';
export const MENSAGEM_OUTRA_IMPORTACAO = 'Outra importação foi gravada enquanto esta janela estava aberta. Nada foi gravado. Feche a janela e importe os arquivos de novo.';

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}$/;
// Id da linha "Voltou a treinar": volta_{leadId}_{inicioFalta}.
const VOLTA_RE = /^volta_(.+)_(\d{4}-\d{2}-\d{2})$/;
const STATUS_DO_ALUNO = ['faltando', 'voltou', 'encerrado'];
const ORIGENS_DO_NOME = ['telefone', 'manual'];
const ORIGENS_DA_PRESENCA = ['catraca', 'agenda'];

const ehDia = (v) => typeof v === 'string' && DIA_RE.test(v);
const ehTexto = (v) => typeof v === 'string' && v.trim() !== '';
const ehObjetoComum = (v) => v !== null && typeof v === 'object'
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

// O que o Firestore aceita como id de documento: sem barra, sem ser só "." ou
// "..", sem o formato __x__ e com até 1.500 bytes.
export const idValido = (id) => typeof id === 'string'
  && id !== '' && id !== '.' && id !== '..'
  && !id.includes('/') && !/^__.*__$/.test(id)
  && new TextEncoder().encode(id).length <= 1500;

// As mensagens de erro citam a posição na lista ou o id do lead, e nunca o
// nome: o erro pode ir para o Sentry, e nome de aluno ou de professor não vai
// para lá.
const invalido = (motivo) => new Error(`plano da importação inválido: ${motivo}`);

// Erro com código, como os do Firestore, para a tela escolher a mensagem.
export const erroDaGravacao = (code, message) => Object.assign(new Error(message), { code });

// O aluno e o período de uma linha "Voltou a treinar", tirados do id, ou null
// para id fora do formato. É assim que a volta desfeita, que o plano manda só
// pelo id, entra na unidade do aluno.
export function voltaDoId(id) {
  const m = typeof id === 'string' ? VOLTA_RE.exec(id) : null;
  if (!m || idDaVolta(m[1], m[2]) !== id) return null;
  return { leadId: m[1], inicioFalta: m[2] };
}

// O Firestore do app recusa `undefined` em qualquer campo, e a recusa derruba
// o lote inteiro. Procura em objetos comuns e listas; o resto (Timestamp, a
// hora do servidor) é folha. Devolve o caminho do primeiro achado, ou null.
export function caminhoIndefinido(valor, caminho = '') {
  if (valor === undefined) return caminho || '(raiz)';
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i += 1) {
      const achado = caminhoIndefinido(valor[i], `${caminho}[${i}]`);
      if (achado) return achado;
    }
    return null;
  }
  if (ehObjetoComum(valor)) {
    for (const [k, v] of Object.entries(valor)) {
      const achado = caminhoIndefinido(v, caminho ? `${caminho}.${k}` : k);
      if (achado) return achado;
    }
  }
  return null;
}

// O registro da importação só informa: um campo sem valor nos números, nos
// avisos ou nos não ligados sai do registro em vez de travar a importação. No
// estado, nas presenças, nos nomes e na linha da volta, campo sem valor é
// defeito do plano e para tudo.
export function semIndefinidos(valor) {
  if (Array.isArray(valor)) return valor.map((v) => (v === undefined ? null : semIndefinidos(v)));
  if (ehObjetoComum(valor)) {
    return Object.fromEntries(
      Object.entries(valor).filter(([, v]) => v !== undefined).map(([k, v]) => [k, semIndefinidos(v)])
    );
  }
  return valor;
}

// Outra importação entrou depois que a janela leu a configuração? A última
// importação no servidor tem de ser a que a janela leu na abertura, ou esta
// mesma (o fecho dela já foi gravado e só a resposta se perdeu).
export function outraImportacaoEntrou({ noServidor, lida, importacaoId }) {
  const atual = noServidor?.id ?? null;
  return atual !== (lida?.id ?? null) && atual !== importacaoId;
}

// Confere o plano antes de qualquer leitura ou gravação e devolve o id da
// importação. Plano com recusa, com professor novo sem ligação ou com o id
// que não bate com as datas dos arquivos não grava nada.
export function conferirPlano(plano) {
  if (!plano) throw invalido('sem plano');
  if (plano.recusa) throw invalido(`plano com recusa (${plano.recusa.codigo ?? 'sem código'})`);
  if (plano.prontoParaGravar !== true) throw invalido('professor novo da Next Fit sem ligação');
  const id = plano.importacao?.id;
  if (!idValido(id) || id !== idDaImportacao(plano.importacao)) {
    throw invalido(`importação com id ${id}, que não bate com as datas dos arquivos`);
  }
  return id;
}

// A interação "Voltou a treinar". Sai no nome de quem importou (consultantName,
// actorId e actorAuthUid), com o dono do lead nos campos de segurança, como o
// logInteraction. Não leva volumeKind, então não conta no volume de ninguém. E
// não mexe no lead, sem lastInteractionAt e sem interactionsCount, como a
// importação de clientes. O createdAt é a hora da importação; o dia da volta
// vai no texto e em voltouEm ou voltouEntre.
export function montarVolta({ volta, importacaoId, quem = null, carimbo }) {
  return {
    colecao: 'interacoes',
    id: volta.id,
    dados: {
      leadId: volta.leadId,
      leadName: volta.lead?.name ?? null,
      type: PRESENCE_RETURN_TYPE,
      text: volta.text,
      voltouEm: ehDia(volta.voltouEm) ? volta.voltouEm : null,
      voltouEntre: ehDia(volta.voltouEm) ? null : { de: volta.voltouEntre.de, ate: volta.voltouEntre.ate },
      inicioFalta: volta.inicioFalta,
      importacaoId,
      consultantName: quem?.nome || null,
      ...getInteractionSecurityFields(volta.lead, { id: quem?.id, authUid: quem?.uid }),
      actorId: quem?.id ?? null,
      actorAuthUid: quem?.uid ?? null,
      createdAt: carimbo,
    },
  };
}

function conferirEstado(e, i) {
  if (!idValido(e?.leadId)) throw invalido(`estados[${i}] sem leadId`);
  if (!ehObjetoComum(e.doc)) throw invalido(`estado do aluno ${e.leadId}`);
  if (e.doc.leadId !== undefined && e.doc.leadId !== e.leadId) throw invalido(`estado do aluno ${e.leadId} com outro leadId dentro`);
  if (!STATUS_DO_ALUNO.includes(e.doc.status)) throw invalido(`estado do aluno ${e.leadId} com status desconhecido`);
}

function conferirVolta(v, i) {
  if (!idValido(v?.leadId)) throw invalido(`voltas[${i}] sem leadId`);
  if (!ehDia(v.inicioFalta)) throw invalido(`volta do aluno ${v.leadId} sem inicioFalta`);
  if (v.id !== idDaVolta(v.leadId, v.inicioFalta)) throw invalido(`volta do aluno ${v.leadId} com id fora do formato`);
  const temDia = ehDia(v.voltouEm);
  const temIntervalo = Boolean(v.voltouEntre && ehDia(v.voltouEntre.de) && ehDia(v.voltouEntre.ate)
    && v.voltouEntre.de <= v.voltouEntre.ate);
  if (temDia === temIntervalo) throw invalido(`volta do aluno ${v.leadId} precisa de voltouEm ou de voltouEntre, um só`);
  if (!ehTexto(v.text)) throw invalido(`volta do aluno ${v.leadId} sem texto`);
}

function conferirPresenca(p, i) {
  const d = p?.doc;
  if (!d || !idValido(d.leadId) || !MES_RE.test(d.mes ?? '')) throw invalido(`presencasPorDoc[${i}]`);
  if (p.id !== `${d.leadId}_${d.mes}`) throw invalido(`presencasPorDoc[${i}] com id ${p.id} em vez de ${d.leadId}_${d.mes}`);
  if (!ehObjetoComum(d.dias) || Object.keys(d.dias).length === 0) throw invalido(`presencas ${p.id} sem dias`);
  for (const [dia, v] of Object.entries(d.dias)) {
    if (!ehDia(dia) || dia.slice(0, 7) !== d.mes) throw invalido(`dia ${dia} fora do mês ${d.mes} em ${p.id}`);
    if (!(v?.hora === null || HORA_RE.test(v?.hora ?? ''))) throw invalido(`hora do dia ${dia} em ${p.id}`);
    if (!Array.isArray(v.origens) || !v.origens.every((o) => ORIGENS_DA_PRESENCA.includes(o))) {
      throw invalido(`origem do dia ${dia} em ${p.id}`);
    }
    if (!Array.isArray(v.modalidades) || !v.modalidades.every(ehTexto)) throw invalido(`modalidades do dia ${dia} em ${p.id}`);
  }
}

function conferirLinks(links) {
  if (!Array.isArray(links)) throw invalido('professorLinks precisa ser uma lista');
  const nomes = new Set();
  links.forEach((l, i) => {
    if (!ehTexto(l?.nome)) throw invalido(`professorLinks[${i}] sem nome`);
    if (!(l.professorId === null || ehTexto(l.professorId))) throw invalido(`professorLinks[${i}] sem professorId nem "Sem professor"`);
    if (nomes.has(l.nome)) throw invalido(`professorLinks[${i}] repetido`);
    nomes.add(l.nome);
  });
}

function montarNome(n, i, carimbo) {
  if (!idValido(n?.id)) throw invalido(`nomesAlunos[${i}] sem chave`);
  const d = n.doc;
  if (!ehTexto(d?.nomeNextFit)) throw invalido(`nomesAlunos[${i}] sem o nome da Next Fit`);
  if (!Array.isArray(d.leadIds) || d.leadIds.length === 0 || !d.leadIds.every(idValido)) throw invalido(`nomesAlunos[${i}] sem aluno`);
  if (!ORIGENS_DO_NOME.includes(d.origem)) throw invalido(`nomesAlunos[${i}] com origem da ligação desconhecida`);
  return {
    colecao: 'alunos',
    id: n.id,
    dados: { nomeNextFit: d.nomeNextFit, leadIds: [...new Set(d.leadIds)], origem: d.origem, atualizadoEm: carimbo },
  };
}

// Monta todas as gravações da importação, em unidades que não se partem:
// - as ligações primeiro: a lista de professores da Next Fit (só quando o
//   plano manda, porque mudou) e cada nome de aluno guardado. Assim a escolha
//   do gestor fica guardada mesmo que a gravação pare depois;
// - depois um aluno por unidade: o estado, a linha "Voltou a treinar" que
//   sai, a que é desfeita (apagada) e os meses de presença entram juntos ou
//   ficam de fora juntos. Se o estado virasse "voltou" num lote e a linha
//   ficasse num lote que falhou, a importação refeita não veria mais o aluno
//   faltando e a linha nunca seria gravada;
// - e, à parte, o fecho: o registro da importação e a última importação em
//   stronix_config/faltosos, que vão por último e num lote só.
//
// O registro guarda os números da prévia que o gestor confirmou (`registro`,
// que por padrão é o do próprio plano). Quando ele já existe (a mesma
// importação feita de novo), o fecho só troca os não ligados, que são os "Não
// achados" da aba Faltosos, e diz quando foi refeita. Os números, quem
// importou, quando, e a última importação ficam como estavam: a importação
// refeita não vê de novo o que a primeira já mudou, e os números dela sairiam
// menores.
//
// Confere tudo antes: plano com defeito não grava nada.
export function montarGravacoes({ plano, registro = plano?.registro, quem = null, registroJaExiste = false, carimbo }) {
  const importacaoId = conferirPlano(plano);
  if (!ehObjetoComum(registro)) throw invalido('importação sem o registro');
  if (registro.id !== undefined && registro.id !== importacaoId) throw invalido(`registro com id ${registro.id}, mas a importação é ${importacaoId}`);

  const porAluno = new Map();
  const doAluno = (leadId) => {
    if (!porAluno.has(leadId)) porAluno.set(leadId, { estado: [], desfeitas: [], voltas: [], presencas: [] });
    return porAluno.get(leadId);
  };

  (plano.estados || []).forEach((e, i) => {
    conferirEstado(e, i);
    const aluno = doAluno(e.leadId);
    if (aluno.estado.length) throw invalido(`dois estados do aluno ${e.leadId}`);
    aluno.estado.push({ colecao: 'faltosos', id: e.leadId, dados: e.doc });
  });

  // Uma linha de volta por aluno: o plano manda só a do período mais recente.
  const idsDasVoltas = new Set();
  (plano.voltas || []).forEach((v, i) => {
    conferirVolta(v, i);
    if (idsDasVoltas.has(v.id)) throw invalido(`duas linhas ${v.id}`);
    idsDasVoltas.add(v.id);
    const aluno = doAluno(v.leadId);
    if (!aluno.estado.length) throw invalido(`volta do aluno ${v.leadId} sem o estado dele`);
    if (aluno.voltas.length) throw invalido(`duas linhas de volta do aluno ${v.leadId}`);
    aluno.voltas.push(montarVolta({ volta: v, importacaoId, quem, carimbo }));
  });

  (plano.voltasDesfeitas || []).forEach((id, i) => {
    const volta = voltaDoId(id);
    if (!volta) throw invalido(`voltasDesfeitas[${i}] com id fora do formato`);
    const aluno = doAluno(volta.leadId);
    if (!aluno.estado.length) throw invalido(`volta desfeita do aluno ${volta.leadId} sem o estado dele`);
    // A mesma linha gravada de novo neste plano: o set troca o documento
    // inteiro, e apagar antes não muda nada.
    if (idsDasVoltas.has(id)) return;
    aluno.desfeitas.push({ colecao: 'interacoes', id, apagar: true });
  });

  const idsDasPresencas = new Set();
  (plano.presencasPorDoc || []).forEach((p, i) => {
    conferirPresenca(p, i);
    if (idsDasPresencas.has(p.id)) throw invalido(`presencas ${p.id} repetido`);
    idsDasPresencas.add(p.id);
    doAluno(p.doc.leadId).presencas.push({
      colecao: 'presencas',
      id: p.id,
      dados: { leadId: p.doc.leadId, mes: p.doc.mes, dias: p.doc.dias },
      merge: true,
    });
  });

  const unidades = [];
  const professorLinks = plano.config?.professorLinks;
  if (professorLinks != null) {
    conferirLinks(professorLinks);
    unidades.push([{
      colecao: 'config',
      dados: { professorLinks: professorLinks.map((l) => ({ nome: l.nome, professorId: l.professorId ?? null })) },
      merge: true,
    }]);
  }
  const chaves = new Set();
  (plano.nomesAlunos || []).forEach((n, i) => {
    const op = montarNome(n, i, carimbo);
    if (chaves.has(op.id)) throw invalido(`nomesAlunos[${i}] repetido`);
    chaves.add(op.id);
    unidades.push([op]);
  });
  for (const leadId of [...porAluno.keys()].sort()) {
    const a = porAluno.get(leadId);
    unidades.push([...a.estado, ...a.desfeitas, ...a.voltas, ...a.presencas]);
  }

  let fecho;
  if (registroJaExiste) {
    fecho = [{
      colecao: 'importacoes',
      id: importacaoId,
      dados: { naoLigados: semIndefinidos(registro.naoLigados ?? null), refeitaEm: carimbo, refeitaPorNome: quem?.nome || null },
      merge: true,
    }];
  } else {
    const ultima = plano.config?.ultimaImportacao;
    if (!ehObjetoComum(ultima) || ultima.id !== importacaoId) throw invalido('última importação sem o id desta importação');
    fecho = [
      {
        colecao: 'importacoes',
        id: importacaoId,
        dados: {
          ...semIndefinidos(registro),
          importadoPor: quem?.id ?? null,
          importadoPorNome: quem?.nome || null,
          importadoEm: carimbo,
        },
      },
      {
        colecao: 'config',
        dados: { ultimaImportacao: { ...ultima, importadoEm: carimbo, importadoPorNome: quem?.nome || null } },
        merge: true,
      },
    ];
  }

  for (const op of [...unidades.flat(), ...fecho]) {
    if (op.apagar) continue;
    const achado = caminhoIndefinido(op.dados);
    // O id de 'alunos' é o nome do aluno: fica fora da mensagem.
    const onde = op.colecao === 'alunos' || op.colecao === 'config' ? op.colecao : `${op.colecao}/${op.id}`;
    if (achado) throw invalido(`campo sem valor (undefined) em ${onde}: ${achado}`);
  }
  return { importacaoId, unidades, fecho };
}

// Junta as unidades em lotes de até `limite` gravações, na ordem, sem partir
// nenhuma unidade.
export function empacotarEmLotes(unidades, limite = LIMITE_POR_LOTE) {
  const lotes = [];
  let atual = [];
  for (const unidade of unidades) {
    if (unidade.length === 0) continue;
    if (unidade.length > limite) throw invalido(`uma unidade com ${unidade.length} gravações, acima de ${limite}`);
    if (atual.length + unidade.length > limite) {
      lotes.push(atual);
      atual = [];
    }
    atual.push(...unidade);
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}
