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

// Endereço público do Stronilead, o mesmo para todas as academias: um sistema
// só atende todas elas, e o que separa uma academia da outra é o identificador
// e a chave. Vai no campo "Endereço do CRM" do Stronizap SEM o /api/zap,
// porque o Stronizap acrescenta esse caminho sozinho.
//
// Fixo de propósito. window.location.origin daria localhost, que o Stronizap
// recusa, ou um endereço de preview, que muda a cada deploy, quando o admin
// abre esta tela fora da produção.
export const STRONILEAD_URL = 'https://crm-stronix.vercel.app';

// O que o Stronizap pede em Configurações → Stronilead, com os mesmos nomes e
// na mesma ordem do formulário de lá. A chave, o terceiro campo, fica de fora:
// ela só existe no navegador entre o "Gerar" e o admin sair da tela.
export function zapConnectionFields(tenantId) {
  return [
    { id: 'endereco', label: 'Endereço do CRM', value: STRONILEAD_URL },
    { id: 'identificador', label: 'Identificador da academia', value: tenantId || '' }
  ];
}
