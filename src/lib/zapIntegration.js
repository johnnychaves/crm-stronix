// Estado da integração com o Stronizap, para a tela de Configurações.
// O valor da chave em claro nunca chega aqui: o front só conhece o prefixo.
export const ZAP_STATE = {
  DESCONECTADO: 'desconectado',
  CONECTADO: 'conectado',
  REVOGADO: 'revogado'
};

export const ZAP_STATE_LABEL = {
  desconectado: 'Não conectado',
  conectado: 'Conectado',
  revogado: 'Chave revogada'
};

export function zapIntegrationState(zap) {
  if (!zap?.keyHash) return ZAP_STATE.DESCONECTADO;
  if (zap.revokedAt) return ZAP_STATE.REVOGADO;
  return ZAP_STATE.CONECTADO;
}
