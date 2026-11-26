// As contas do bloco Faltosos de Configurações → Metas & ritmo (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações"): os marcos de falta, a janela do urgente e a troca do
// professor ligado a cada nome da Next Fit. A leitura do documento
// stronix_config/faltosos mora em ./configFaltosos.js, e a regra dos marcos que
// vale na importação, em ./marcos.js (normalizarMarcos). Aqui ficam só as
// regras de editar, com o texto que a tela mostra. Puro: sem React e sem
// Firebase.

import { isActiveProfessor } from '../teamRoles.js';

export const MARCOS_MAX = 6;
export const DIAS_MIN = 1;
export const DIAS_MAX = 365;

export const MENSAGENS_DO_BLOCO = Object.freeze({
  marcoForaDoLimite: `Informe um número inteiro de dias entre ${DIAS_MIN} e ${DIAS_MAX}.`,
  marcoRepetido: (n) => `O marco de ${n} ${n === 1 ? 'dia' : 'dias'} já existe.`,
  marcosDemais: `São no máximo ${MARCOS_MAX} marcos.`,
  marcoUltimo: 'Mantenha ao menos um marco de falta.',
  janelaForaDoLimite: `Informe um número inteiro de dias entre ${DIAS_MIN} e ${DIAS_MAX}.`,
});

const inteiroNoLimite = (n) => Number.isInteger(n) && n >= DIAS_MIN && n <= DIAS_MAX;

// Texto de um campo numérico para número. Vazio, espaço e texto que não é
// número dão NaN, que nenhum limite aceita.
const numeroDoCampo = (valor) => {
  if (typeof valor === 'number') return valor;
  const texto = String(valor ?? '').trim();
  return texto === '' ? NaN : Number(texto);
};

// Marco novo, pela regra da spec: de 1 a 6 números de 1 a 365, sem repetir.
// Devolve { marcos } com a lista nova em ordem crescente, ou { erro } com o
// texto para a tela.
export function adicionarMarco(marcos, valor) {
  const atuais = Array.isArray(marcos) ? marcos : [];
  const n = numeroDoCampo(valor);
  if (!inteiroNoLimite(n)) return { erro: MENSAGENS_DO_BLOCO.marcoForaDoLimite };
  if (atuais.includes(n)) return { erro: MENSAGENS_DO_BLOCO.marcoRepetido(n) };
  if (atuais.length >= MARCOS_MAX) return { erro: MENSAGENS_DO_BLOCO.marcosDemais };
  return { marcos: [...atuais, n].sort((a, b) => a - b) };
}

// Tira um marco. O último fica, porque sem marco nenhum ninguém vira tarefa.
export function removerMarco(marcos, n) {
  const atuais = Array.isArray(marcos) ? marcos : [];
  const restantes = atuais.filter((m) => m !== n);
  if (restantes.length === 0) return { erro: MENSAGENS_DO_BLOCO.marcoUltimo };
  return { marcos: restantes };
}

// Janela do urgente: inteiro de 1 a 365 dias.
export function validarJanelaUrgente(valor) {
  const n = numeroDoCampo(valor);
  return inteiroNoLimite(n) ? { dias: n } : { erro: MENSAGENS_DO_BLOCO.janelaForaDoLimite };
}

const ligacaoValida = (l) => Boolean(l) && typeof l.nome === 'string' && l.nome.trim() !== '';
const idOuNull = (id) => (typeof id === 'string' && id.trim() ? id : null);

// Troca o professor ligado a um nome da Next Fit e devolve a lista inteira,
// na mesma ordem, para gravar (professorLinks é lista: o set com merge troca a
// lista toda). Texto vazio é "Sem professor" (null). Nome que não está na
// lista não entra: a lista só cresce pela importação.
export function trocarLigacaoProfessor(links, nome, professorId) {
  const id = idOuNull(professorId);
  return (Array.isArray(links) ? links : [])
    .filter(ligacaoValida)
    .map((l) => ({ nome: l.nome, professorId: l.nome === nome ? id : idOuNull(l.professorId) }));
}

const porNome = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });

// As ligações em ordem de nome, para a tela, sem ligar para acento e caixa.
export const ligacoesEmOrdem = (links) => (Array.isArray(links) ? links : [])
  .filter(ligacaoValida)
  .slice()
  .sort((a, b) => porNome(a.nome, b.nome));

// Opções da escolha de professor de uma linha: "Sem professor" primeiro e os
// ativos do cadastro em ordem de nome. O professor que a linha já tem continua
// na lista mesmo inativo ou fora do cadastro, para a escolha mostrar o valor
// de verdade.
export const SEM_PROFESSOR = 'Sem professor';
export function opcoesDeProfessor(professores, atualId = null) {
  const lista = (Array.isArray(professores) ? professores : []).filter((p) => p && typeof p.id === 'string' && p.id);
  const ativos = lista.filter(isActiveProfessor).sort((a, b) => porNome(a.nome, b.nome));
  const opcoes = [{ value: '', label: SEM_PROFESSOR }, ...ativos.map((p) => ({ value: p.id, label: p.nome || 'Professor sem nome' }))];
  if (atualId && !ativos.some((p) => p.id === atualId)) {
    const atual = lista.find((p) => p.id === atualId);
    opcoes.push({ value: atualId, label: atual ? `${atual.nome || 'Professor sem nome'} (inativo)` : 'Professor fora do cadastro' });
  }
  return opcoes;
}
