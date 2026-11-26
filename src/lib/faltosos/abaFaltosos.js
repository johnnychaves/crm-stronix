// Os textos e a regra de quem importa que o bloco Faltosos de Configurações
// mostra hoje e a aba Faltosos de Clientes vai mostrar (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A aba
// Faltosos", e docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md).
// Puro, testado em node. A aba (o PR 2B) acrescenta aqui os grupos, o
// andamento e o filtro.

import { isGestor } from '../acesso.js';
import { hasModule, MODULES } from '../modules.js';
import { getSafeDateOrNull } from '../dates.js';
import { horaDeBrasilia } from '../../../api/_horarioDeBrasilia.js';
import { ddmm, ddmmaaaa, diaEmBrasilia, somarDias } from './dias.js';
import { normalizarMarcos } from './marcos.js';

const comModulo = (appUser) => hasModule(appUser?.tenantModules, MODULES.FALTOSOS);

// Quem importa as planilhas: só o gestor, com o módulo ligado.
export const importaFaltosos = (appUser) => comModulo(appUser) && isGestor(appUser);

// Os textos sobre a última importação. O dia e a hora são os de Brasília, como
// o resto da importação.
export function resumoDaUltimaImportacao(ultima) {
  if (!ultima?.id) return null;
  const em = getSafeDateOrNull(ultima.importadoEm);
  const quando = em ? `${ddmm(diaEmBrasilia(em))} às ${horaDeBrasilia(em)}` : 'Data não registrada';
  const por = ultima.importadoPorNome ? `, por ${ultima.importadoPorNome}` : '';
  const p = ultima.periodoPresencas;
  return {
    quando: `${quando}${por}`,
    faltantes: ultima.dataFaltantes ? `Faltantes de ${ddmmaaaa(ultima.dataFaltantes)}` : 'Nenhum Faltantes importado',
    presencas: p?.de && p?.ate ? `Presenças de ${ddmm(p.de)} a ${ddmm(p.ate)}` : 'Nenhum Presenças importado',
  };
}

// Como exportar da Next Fit (spec, "Os arquivos"): o Faltantes com o menor
// marco, e o Presenças do dia seguinte ao último dia já importado até hoje.
export function lembreteExportacao({ marcos = [], ultimaImportacao = null, hojeDia = null } = {}) {
  const menor = normalizarMarcos(marcos)[0];
  const faltantes = `Faltantes: exporte com o filtro de ${menor} dias sem vir.`;
  const ate = ultimaImportacao?.ultimoDiaPresencas || ultimaImportacao?.periodoPresencas?.ate || null;
  const proximo = ate ? somarDias(ate, 1) : null;
  let presencas = 'Presenças: exporte a última semana, até hoje.';
  if (proximo && hojeDia && proximo > hojeDia) presencas = 'Presenças: já está importado até hoje.';
  else if (proximo) presencas = `Presenças: exporte de ${ddmm(proximo)} até hoje.`;
  return { faltantes, presencas };
}
