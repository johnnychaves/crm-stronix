// A configuração dos faltosos, doc único em stronix_config/faltosos: os
// marcos, a janela do urgente, a ligação dos professores da Next Fit e o
// resumo da última importação. A importação grava professorLinks e
// ultimaImportacao; o bloco Faltosos de Metas & ritmo grava marcos, janela e
// professorLinks. O App assina o doc com o módulo ligado e entrega o que sai
// daqui pelo GeneralConfigContext (`faltosos`), e a importação lê o doc pelo
// mesmo caminho. Puro, testado em node. O id do doc (CONFIG_FALTOSOS_ID) mora
// em src/lib/firebase.js, com os caminhos das coleções do módulo.
// Spec: docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md ("Os dados" e "Configurações").
import { normalizarJanelaUrgente, normalizarMarcos } from './marcos.js';
import { normalizarProfessorLinks } from './ligacaoProfessores.js';
import { diaValido, maiorDia } from './dias.js';
import { getSafeDateOrNull } from '../dates.js';

// As regras de cada campo moram nos módulos do motor e saem daqui também,
// para quem lê a configuração ter um lugar só para importar.
export { normalizarJanelaUrgente, normalizarMarcos, normalizarProfessorLinks };

const diaOuNull = (v) => (diaValido(v) ? v : null);

// { de, ate } com dois dias válidos, o primeiro até o último; senão null.
export const periodoOuNull = (p) => (
  p && typeof p === 'object' && diaValido(p.de) && diaValido(p.ate) && p.de <= p.ate ? { de: p.de, ate: p.ate } : null
);

// O resumo da última importação, ou null quando nunca houve uma (sem id). É
// por ele que o professor, que não lê stronix_importacoes_nextfit, sabe quando
// foi, e que a importação seguinte tira o E0 dos marcos, a recusa do
// Faltantes mais antigo e o aviso de buraco no Presenças.
// - dataFaltantes: o último Faltantes importado, mesmo que a última
//   importação tenha trazido só o Presenças;
// - dataFaltantesAnterior: o E0 que esse Faltantes usou, para a mesma data
//   importada de novo chegar ao mesmo resultado;
// - periodoPresencas: o último Presenças (entre dois, o que termina depois);
// - ultimoDiaPresencas: o maior dia de Presenças já importado;
// - importadoEm e importadoPorNome: gravados pela importação.
export function normalizarUltimaImportacao(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const periodoPresencas = periodoOuNull(raw.periodoPresencas);
  return {
    id: raw.id,
    dataFaltantes: diaOuNull(raw.dataFaltantes),
    dataFaltantesAnterior: diaOuNull(raw.dataFaltantesAnterior),
    periodoPresencas,
    ultimoDiaPresencas: maiorDia(raw.ultimoDiaPresencas, periodoPresencas?.ate),
    importadoEm: getSafeDateOrNull(raw.importadoEm),
    importadoPorNome: typeof raw.importadoPorNome === 'string' ? raw.importadoPorNome.trim() : '',
  };
}

export function normalizarConfigFaltosos(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    marcos: normalizarMarcos(d.marcos),
    janelaUrgenteDias: normalizarJanelaUrgente(d.janelaUrgenteDias),
    professorLinks: normalizarProfessorLinks(d.professorLinks),
    ultimaImportacao: normalizarUltimaImportacao(d.ultimaImportacao),
  };
}

// Doc ausente: academia que ainda não importou nem configurou nada. O objeto
// é congelado; a lista de marcos dele não, então quem lê não ordena no lugar.
export const CONFIG_FALTOSOS_PADRAO = Object.freeze(normalizarConfigFaltosos(null));

// O que as telas usam quando o contexto ainda não tem a configuração (fora do
// App, nos testes, ou antes da primeira leitura).
export const configDasTelas = (faltosos) => faltosos ?? { ...CONFIG_FALTOSOS_PADRAO, pronta: false };
