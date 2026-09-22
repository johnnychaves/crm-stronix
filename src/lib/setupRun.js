// Estado da configuração de funis do primeiro login de gestor, guardado junto
// com a academia a que pertence.
//
// Por quê: o "Acessar como" (SuperConsole e SuperAdminView) troca de conta com
// signInWithCustomToken, sem recarregar a página. Um status 'done' ou 'error',
// ou uma marca de "já configurado", que não sabe de qual academia veio vale
// também para a próxima academia assumida na mesma aba. Aí a configuração
// pendente dela só rodava depois de um F5, ou a academia nova herdava a marca
// da anterior e se dava por configurada sem rodar nada.
//
// Aqui o estado carrega a academia, e o App deriva no render o que vale para a
// academia atual. O que é de outra academia conta como parado ('idle') e como
// "config ainda não chegou" (null). Rodar de novo é inofensivo, porque as
// gravações da configuração têm id fixo e só criam (funnelSetup.js e
// funnelSetupWrites.js).
//
// Sem React e sem Firebase, para testar em node.

// Execução de uma máquina de configuração que ainda não começou em academia nenhuma.
export const IDLE_RUN = Object.freeze({ tenant: null, status: 'idle' });

// Status ('idle' | 'running' | 'done' | 'error') da execução para a academia
// pedida. Execução de outra academia, ou sessão sem academia, é 'idle'.
export function runStatusFor(run, tenantId) {
  if (!tenantId) return 'idle';
  if (run?.tenant !== tenantId) return 'idle';
  return run.status;
}

// Fim de uma execução: só grava se a vaga ainda é da academia dessa execução.
// Uma execução atrasada da academia anterior (o "Acessar como" trocou a conta
// no meio) não apaga o estado da academia atual.
export function settleRun(prev, tenant, status) {
  return prev?.tenant === tenant ? { tenant, status } : prev;
}

// Marcas de "já configurado" antes de o config de qualquer academia chegar.
export const EMPTY_SETUP_FLAGS = Object.freeze({
  tenant: null,
  funnels: null,
  referral: null,
  expired: null,
  renewal: null,
  upgrade: null,
});

// Marcas lidas do doc stronix_config/general da academia `tenant`. Doc
// inexistente (data null) conta como não configurado: a configuração roda e
// carimba.
export function setupFlagsFromConfig(tenant, data) {
  return {
    tenant,
    funnels: !!data?.funnelsSetupDoneAt,
    referral: !!data?.referralSetupDoneAt,
    // v2: a chave mudou para o Vencidos rodar uma vez a mais e renomear a etapa
    // de entrada. A antiga (expiredFunnelSetupDoneAt) não conta.
    expired: !!data?.expiredFunnelSetupV2DoneAt,
    renewal: !!data?.renewalFunnelSetupDoneAt,
    upgrade: !!data?.upgradeFunnelSetupDoneAt,
  };
}

// Uma marca (`key`) para a academia pedida. null quando o config desta
// academia ainda não chegou, inclusive quando as marcas guardadas são de outra.
export function setupFlagFor(flags, key, tenantId) {
  if (!tenantId) return null;
  if (flags?.tenant !== tenantId) return null;
  return flags[key] ?? null;
}
