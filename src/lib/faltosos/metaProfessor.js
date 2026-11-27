// Regra da Meta diária do professor (adendo de 27/11/2026 da spec
// 2026-10-16-professor-pr2-em-tres-partes-design.md). Pura: a tela, o sino e os
// testes leem daqui. Não importa pacote nem firebase.js.
import { diasEntre, ddmm } from './dias.js';
import { STATUS, TAREFA } from './planoImportacao.js';

export const CANAIS = Object.freeze([
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'ligacao', label: 'Ligação' },
  { id: 'pessoalmente', label: 'Pessoalmente' },
]);

export const RESULTADOS = Object.freeze([
  { id: 'vai_voltar', label: 'Vai voltar', desc: 'Combinou de voltar a treinar.', tone: 'ok' },
  { id: 'respondeu', label: 'Respondeu', desc: 'Conversou, mas sem data para voltar.', tone: 'later' },
  { id: 'nao_respondeu', label: 'Não respondeu', desc: 'Mandou mensagem ou ligou e ficou sem resposta.', tone: 'later' },
  { id: 'quer_cancelar', label: 'Quer cancelar', desc: 'O gestor recebe o aviso no sino.', tone: 'no' },
]);

export const resultadoTexto = (id) => RESULTADOS.find((r) => r.id === id)?.label || '';
export const canalTexto = (id) => CANAIS.find((c) => c.id === id)?.label || '';

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : null);

export const diasSemVir = (doc, hojeDia) => (doc?.ultimaPresenca ? diasEntre(doc.ultimaPresenca, hojeDia) : null);

// Pendente: o aluno está faltando e a tarefa é deste período e está aberta. É a
// mesma conta do planoImportacao (a tarefa de um período anterior não vale).
export const ehPendente = (d) => d?.status === STATUS.FALTANDO
  && d?.tarefa?.status === TAREFA.PENDENTE
  && d.tarefa.inicioFalta === d.inicioFalta;

export function pendentesDe(docs, hojeDia, nomeDe = () => '') {
  return (docs || []).filter(ehPendente).sort((a, b) => (
    (Number(Boolean(b.urgente)) - Number(Boolean(a.urgente)))
    || ((diasSemVir(b, hojeDia) ?? 0) - (diasSemVir(a, hojeDia) ?? 0))
    || String(nomeDe(a.id) || '').localeCompare(String(nomeDe(b.id) || ''), 'pt-BR')
  ));
}

// Feitos desde a última importação, o mais recente primeiro. "Voltou" pela
// importação não tem feitaEm e não conta: ninguém fez o contato.
export function feitosDaSemana(docs, desde) {
  const inicio = ms(desde);
  if (inicio == null) return [];
  return (docs || [])
    .filter((d) => [TAREFA.FEITA, TAREFA.VOLTOU].includes(d?.tarefa?.status) && (ms(d.tarefa.feitaEm) ?? -1) >= inicio)
    .sort((a, b) => ms(b.tarefa.feitaEm) - ms(a.tarefa.feitaEm));
}

export function gruposDaSemana(pendentes, marcos) {
  const lista = pendentes || [];
  return [
    { id: 'urgentes', nome: 'Urgentes', total: lista.filter((d) => d.urgente).length },
    ...[...(marcos || [])].sort((a, b) => b - a).map((m) => ({
      id: String(m), nome: `${m} dias sem vir`, total: lista.filter((d) => !d.urgente && d.tarefa?.marco === m).length,
    })),
  ];
}

export const motivoDe = (d) => (d?.urgente
  ? `Urgente: o contrato termina em ${ddmm(d.contratoTerminaEm)}`
  : `Marco dos ${d?.tarefa?.marco} dias sem vir`);

export const fraseDe = (d, hojeDia) => ({
  dias: diasSemVir(d, hojeDia),
  desde: ddmm(d?.ultimaPresenca),
  termina: d?.urgente ? ddmm(d.contratoTerminaEm) || null : null,
});
