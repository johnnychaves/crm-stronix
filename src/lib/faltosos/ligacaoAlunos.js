// Ligação dos alunos da Next Fit com os clientes do Stronilead. Puro: recebe
// as linhas lidas, os clientes e os nomes guardados em stronix_nextfit_alunos,
// e devolve quem ligou, quem não ligou e quem ficou ambíguo.
//
// - Faltantes: pelo telefone, com a chave do Stronizap (DDD e os últimos 8
//   dígitos, api/_zapPhone.js), que acha o telefone do próprio aluno e o do
//   responsável pelo menor. O telefone só liga quando o nome confere (o
//   primeiro nome igual ou duas palavras em comum): o número da mãe que é
//   cliente não liga o filho a ela. Entre vários clientes do mesmo telefone,
//   o nome igual decide e, sem ele, o único nome que confere. Quando o
//   telefone não decide, vale a ligação feita à mão.
// - Presenças: pelo nome, porque o relatório não traz telefone. Primeiro o
//   nome guardado (pelo Faltantes ou à mão), depois o nome igual entre os
//   clientes. Nome que bate com mais de um cliente, ou com nenhum, não liga.
//
// Só cliente entra (lifecycleBucket 'cliente').
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("A ligação dos alunos").
import { zapMatchKey } from '../../../api/_zapPhone.js';
import { nomeChave } from './nextfitArquivos.js';

// A chave de nome mora no leitor das planilhas, que a usa no cabeçalho, e sai
// daqui também: é a mesma chave dos documentos de stronix_nextfit_alunos.
export { nomeChave };

// Palavras que não contam como "em comum": duas pessoas da mesma família de
// nomes não podem casar só por "da Silva".
const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

// As palavras do nome, pela chave, sem os conectivos.
export const palavrasDoNome = (nome) => new Set(nomeChave(nome).split(' ').filter((p) => p && !CONECTIVOS.has(p)));

// Dois nomes que podem ser da mesma pessoa: o primeiro nome igual, ou pelo
// menos duas palavras em comum. "Ana T. Souza" confere com "Ana Teste Souza";
// "João Souza" não confere com "Rita Souza".
export function nomeConfere(a, b) {
  const primeiroA = nomeChave(a).split(' ')[0];
  const primeiroB = nomeChave(b).split(' ')[0];
  if (primeiroA && primeiroA === primeiroB) return true;
  const deB = palavrasDoNome(b);
  return [...palavrasDoNome(a)].filter((p) => deB.has(p)).length >= 2;
}

export const ehCliente = (lead) => lead?.lifecycleBucket === 'cliente';

// As chaves de telefone do cliente: a do WhatsApp dele e a do responsável,
// quando há. Lê o número gravado e, sem ele, o campo derivado (dado antigo
// pode estar sem o derivado, e o número é o que vale).
const chavesDoCliente = (lead) => [...new Set([
  zapMatchKey(lead?.whatsapp) || lead?.zapMatchKey || null,
  zapMatchKey(lead?.guardian?.phone) || lead?.guardianZapMatchKey || null,
].filter(Boolean))];

const juntar = (map, chave, valor) => {
  const lista = map.get(chave);
  if (lista) lista.push(valor);
  else map.set(chave, [valor]);
};

// Índices dos clientes por id, por chave de telefone e por chave de nome.
export function indiceDeClientes(clientes) {
  const porId = new Map();
  const porTelefone = new Map();
  const porNome = new Map();
  for (const lead of clientes || []) {
    if (!lead?.id || !ehCliente(lead) || porId.has(lead.id)) continue;
    porId.set(lead.id, lead);
    for (const chave of chavesDoCliente(lead)) juntar(porTelefone, chave, lead);
    const nome = nomeChave(lead.name);
    if (nome) juntar(porNome, nome, lead);
  }
  return { porId, porTelefone, porNome };
}

// Os leadIds de um nome guardado que ainda são clientes.
const vivos = (guardado, indice) => (Array.isArray(guardado?.leadIds) ? guardado.leadIds : [])
  .filter((id, i, lista) => typeof id === 'string' && indice.porId.has(id) && lista.indexOf(id) === i);

const indiceDe = (clientes) => (clientes && clientes.porId instanceof Map ? clientes : indiceDeClientes(clientes));

// Entre os clientes do telefone, o que o nome aponta: o único de nome igual
// e, sem nome igual, o único cujo nome confere. null quando o nome não decide.
function escolherPeloNome(candidatos, nome) {
  const chave = nomeChave(nome);
  const iguais = candidatos.filter((l) => nomeChave(l.name) === chave);
  if (iguais.length) return iguais.length === 1 ? iguais[0] : null;
  const conferem = candidatos.filter((l) => nomeConfere(nome, l.name));
  return conferem.length === 1 ? conferem[0] : null;
}

// { ligados: [{ linha, leadId, origem }], naoLigados: [linha], ambiguos: [{ linha, candidatos }] }.
// origem: 'telefone' (do aluno ou do responsável) ou 'manual'. `clientes`
// pode ser a lista ou o índice de indiceDeClientes. O telefone que acha
// clientes sem nome que decida deixa a linha nos ambíguos, com esses clientes
// como candidatos, para a prévia ligar à mão.
export function ligarFaltantes(linhas, clientes, nomesGuardados = {}) {
  const indice = indiceDe(clientes);
  const ligados = [];
  const naoLigados = [];
  const ambiguos = [];
  for (const linha of linhas || []) {
    const chaveNome = nomeChave(linha?.nome);
    const tel = zapMatchKey(linha?.telefone);
    const peloTelefone = tel ? [...new Set(indice.porTelefone.get(tel) || [])] : [];
    const escolhido = escolherPeloNome(peloTelefone, linha?.nome);
    if (escolhido) {
      ligados.push({ linha, leadId: escolhido.id, origem: 'telefone' });
      continue;
    }
    // O telefone não decidiu: vale a ligação feita à mão para esse nome.
    const guardado = chaveNome ? nomesGuardados?.[chaveNome] : null;
    const manual = guardado?.origem === 'manual' ? vivos(guardado, indice) : [];
    if (manual.length === 1) ligados.push({ linha, leadId: manual[0], origem: 'manual' });
    else if (peloTelefone.length) ambiguos.push({ linha, candidatos: peloTelefone.map((l) => l.id) });
    else if (manual.length > 1) ambiguos.push({ linha, candidatos: manual });
    else naoLigados.push(linha);
  }
  return { ligados, naoLigados, ambiguos };
}

// Mesmo formato de ligarFaltantes. origem: 'manual', 'guardado' (nome
// guardado por uma ligação pelo telefone) ou 'nome' (nome igual).
export function ligarPresencas(linhas, clientes, nomesGuardados = {}) {
  const indice = indiceDe(clientes);
  const cache = new Map();
  const resolver = (chaveNome) => {
    if (cache.has(chaveNome)) return cache.get(chaveNome);
    let r = null;
    const guardado = chaveNome ? nomesGuardados?.[chaveNome] : null;
    const doGuardado = guardado ? vivos(guardado, indice) : [];
    if (doGuardado.length === 1) r = { leadId: doGuardado[0], origem: guardado.origem === 'manual' ? 'manual' : 'guardado' };
    else if (doGuardado.length > 1) r = { candidatos: doGuardado };
    else {
      const iguais = chaveNome ? indice.porNome.get(chaveNome) || [] : [];
      if (iguais.length === 1) r = { leadId: iguais[0].id, origem: 'nome' };
      else if (iguais.length > 1) r = { candidatos: iguais.map((l) => l.id) };
    }
    cache.set(chaveNome, r);
    return r;
  };
  const ligados = [];
  const naoLigados = [];
  const ambiguos = [];
  for (const linha of linhas || []) {
    const r = resolver(nomeChave(linha?.nome));
    if (r?.leadId) ligados.push({ linha, leadId: r.leadId, origem: r.origem });
    else if (r?.candidatos) ambiguos.push({ linha, candidatos: r.candidatos });
    else naoLigados.push(linha);
  }
  return { ligados, naoLigados, ambiguos };
}

// O cliente provável de uma linha do Faltantes que não ligou: o do nome
// guardado (de qualquer origem) que aponta para um cliente só ou, sem nome
// guardado, o único cliente com o mesmo nome. null quando não há um só. Não
// liga nada. Serve para a prévia sugerir a ligação à mão e para o plano não
// marcar como "voltou" o aluno cujo telefone mudou no Stronilead: ele sai do
// conjunto ligado, mas o nome dele continua no Faltantes.
export function clienteProvavel(linha, clientes, nomesGuardados = {}) {
  const indice = indiceDe(clientes);
  const chave = nomeChave(linha?.nome);
  if (!chave) return null;
  const guardado = nomesGuardados?.[chave];
  if (guardado) {
    const ids = vivos(guardado, indice);
    if (ids.length) return ids.length === 1 ? ids[0] : null;
  }
  const iguais = indice.porNome.get(chave) || [];
  return iguais.length === 1 ? iguais[0].id : null;
}

const mesmaLista = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Os nomes que a importação guarda em stronix_nextfit_alunos: cada linha do
// Faltantes ligada pelo telefone guarda o nome com que o aluno aparece na Next
// Fit. Devolve só o que muda, como { [nomeChave]: { nomeNextFit, leadIds,
// origem: 'telefone' } }. A ligação feita à mão nunca é trocada aqui. Dois
// alunos da Next Fit com o mesmo nome e telefones diferentes deixam a chave
// com dois leadIds, e o Presenças passa a tratar esse nome como ambíguo. Id
// que deixou de ser cliente sai da lista.
export function nomesParaGuardar(ligados, nomesGuardados = {}, clientes = []) {
  const indice = indiceDe(clientes);
  const atual = {};
  const mudou = {};
  for (const { linha, leadId, origem } of ligados || []) {
    if (origem !== 'telefone') continue;
    const chave = nomeChave(linha?.nome);
    if (!chave) continue;
    const base = atual[chave] || nomesGuardados?.[chave] || null;
    if (base?.origem === 'manual') continue;
    const antes = base ? vivos(base, indice) : [];
    const leadIds = antes.includes(leadId) ? antes : [...antes, leadId];
    const doc = { nomeNextFit: String(linha.nome).trim(), leadIds, origem: 'telefone' };
    atual[chave] = doc;
    const gravado = nomesGuardados?.[chave];
    if (!gravado || !mesmaLista(leadIds, Array.isArray(gravado.leadIds) ? gravado.leadIds : [])
      || gravado.origem !== 'telefone' || gravado.nomeNextFit !== doc.nomeNextFit) mudou[chave] = doc;
  }
  return mudou;
}

// As ligações feitas à mão na prévia, no formato de stronix_nextfit_alunos.
// `manuais` é a lista [{ nomeNextFit, leadId }] que a tela junta; o mesmo
// nome escolhido duas vezes fica com a última escolha.
export function nomesManuais(manuais) {
  const out = {};
  for (const m of manuais || []) {
    const chave = nomeChave(m?.nomeNextFit);
    if (!chave || typeof m.leadId !== 'string' || !m.leadId) continue;
    out[chave] = { nomeNextFit: String(m.nomeNextFit).trim(), leadIds: [m.leadId], origem: 'manual' };
  }
  return out;
}
