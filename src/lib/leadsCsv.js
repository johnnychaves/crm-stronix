// Planilha de Todos os leads (LeadsView): as colunas, na ordem de sempre, e a
// linha de cada lead. Fica fora da tela para o teste conferir o cabeçalho e o
// que cada coluna recebe. A planilha em si (separador, aspas e proteção contra
// fórmula) é a de src/lib/csvExport.js. Puro.

import { contactLabel, contactOf } from './guardian.js';
import { toCsv } from './csvExport.js';

export const LEADS_CSV_COLUMNS = Object.freeze([
  Object.freeze({ key: 'nome', label: 'Nome' }),
  Object.freeze({ key: 'whatsapp', label: 'WhatsApp' }),
  Object.freeze({ key: 'responsavel', label: 'Responsável do aluno' }),
  Object.freeze({ key: 'telefoneResponsavel', label: 'Telefone do responsável' }),
  Object.freeze({ key: 'origem', label: 'Origem' }),
  Object.freeze({ key: 'indicadoPor', label: 'Indicado por' }),
  Object.freeze({ key: 'fase', label: 'Fase do Funil' }),
  Object.freeze({ key: 'consultor', label: 'Consultor' }),
  Object.freeze({ key: 'cadastro', label: 'Data Cadastro' }),
  Object.freeze({ key: 'observacao', label: 'Observação' }),
  Object.freeze({ key: 'motivoPerda', label: 'Motivo Perda' }),
]);

// A linha de um lead. O WhatsApp é o do próprio lead; quando quem atende é o
// responsável do menor (contactOf), o nome e o telefone dele vão nas duas
// colunas do responsável.
export function leadCsvRow(lead, now = new Date()) {
  const contato = contactOf(lead, now);
  return {
    nome: lead.name,
    whatsapp: lead.whatsapp,
    responsavel: contato.viaGuardian ? contactLabel(contato) : '',
    telefoneResponsavel: contato.viaGuardian ? contato.phone : '',
    origem: lead.source,
    indicadoPor: lead.referredByName,
    fase: lead.status,
    consultor: lead.consultantName,
    cadastro: lead.createdAt ? lead.createdAt.toLocaleDateString('pt-BR') : '',
    observacao: lead.observation,
    motivoPerda: lead.lossReason,
  };
}

// O texto da planilha inteira, com um `now` só para todas as linhas. Quem
// monta as linhas à mão não pode passar o leadCsvRow solto ao map, que
// entregaria o índice no lugar do `now`.
export const leadsToCsv = (leads, now = new Date()) => toCsv((leads || []).map((l) => leadCsvRow(l, now)), LEADS_CSV_COLUMNS);
