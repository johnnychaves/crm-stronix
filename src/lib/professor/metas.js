// Metas do plano de carreira do time técnico, guardadas em
// stronix_config/carreira. Só a renovação tem meta por nível (spec
// 2026-11-24-perfil-do-professor, decisão 12). Documento ausente ou campo fora
// do formato vale o padrão, campo a campo, para um gestor que só mexeu numa
// meta não apagar as outras.
export const NIVEIS = Object.freeze(['junior', 'pleno', 'senior']);
const NIVEL_TEXTO = Object.freeze({ junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior' });
export const nivelTexto = (nivel) => NIVEL_TEXTO[nivel] ?? 'Sem nível';

export const METAS_PADRAO = Object.freeze({
  renovacao: Object.freeze({ junior: 45, pleno: 55, senior: 65 }),
  nps: Object.freeze({ meta: 9 }),
  conversao: Object.freeze({ tolerancia: 0, janelaDias: 30 }),
  aderencia: Object.freeze({ barra: 2, faixaMin: 60, faixaMax: 70 }),
});

const PCT = 'Use um número de 0 a 100.';
const LIMITES = {
  'renovacao.junior': [0, 100, PCT],
  'renovacao.pleno': [0, 100, PCT],
  'renovacao.senior': [0, 100, PCT],
  'nps.meta': [0, 10, 'Use uma nota de 0 a 10.'],
  'conversao.tolerancia': [0, 50, 'Use um número de 0 a 50.'],
  'conversao.janelaDias': [0, 90, 'Use um número de 0 a 90.'],
  'aderencia.barra': [1, 5, 'Use um número de 1 a 5.'],
  'aderencia.faixaMin': [0, 100, PCT],
  'aderencia.faixaMax': [0, 100, PCT],
};
const ler = (obj, campo) => campo.split('.').reduce((o, k) => o?.[k], obj);
const valido = (campo, v) => {
  const [min, max] = LIMITES[campo];
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
};

// { campo, texto } do primeiro problema, ou null.
export function problemaDasMetas(m) {
  for (const campo of Object.keys(LIMITES)) {
    if (!valido(campo, ler(m, campo))) return { campo, texto: LIMITES[campo][2] };
  }
  if (m.aderencia.faixaMin >= m.aderencia.faixaMax) {
    return { campo: 'aderencia.faixaMin', texto: 'O começo da faixa precisa ser menor que o fim.' };
  }
  return null;
}

// As metas que valem, a partir do documento (ou de null).
export function metasDe(doc) {
  const out = {};
  for (const [grupo, padrao] of Object.entries(METAS_PADRAO)) {
    out[grupo] = {};
    for (const [k, v] of Object.entries(padrao)) {
      const lido = ler(doc, `${grupo}.${k}`);
      out[grupo][k] = valido(`${grupo}.${k}`, lido) ? lido : v;
    }
  }
  if (out.aderencia.faixaMin >= out.aderencia.faixaMax) out.aderencia = { ...METAS_PADRAO.aderencia };
  return out;
}

// A média esperada de renovação do nível, ou null para quem não tem nível.
export const referenciaDaRenovacao = (metas, nivel) => (NIVEIS.includes(nivel) ? metas.renovacao[nivel] : null);
