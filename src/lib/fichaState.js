// Estados da ficha aberta por endereço (/<academia>/ficha/<id>). Puro: sem
// React e sem Firebase. O useProfileLead guarda a última resposta do Firestore
// e a LeadProfileRoute escolhe o que desenhar, os dois com estas funções.
//
// Status da ficha:
//   invalid  id do endereço que o Firestore não aceita (nem chega a ler)
//   waiting  login ainda terminando: sem sessão, não assina
//   loading  assinatura pedida e ainda sem resposta para ESTA chave
//   ready    doc existe
//   missing  doc não existe (link errado, de outra academia ou excluído antes)
//   deleted  doc sumiu com a ficha aberta (alguém excluiu agora)
//   error    a leitura falhou (internet, permissão), ou só o cache respondeu
//            e sem o doc (sem internet)

import { isValidLeadId } from './routes.js';

// Chave de uma assinatura: sessão, id e tentativa. Trocar qualquer um dos três
// (Sair e entrar, "Acessar como", outra ficha, "Tentar de novo") gera chave nova,
// e resposta de chave velha nunca aparece na tela. JSON e não texto emendado,
// para 'acad:u1' + 'x' não virar o mesmo que 'acad' + 'u1:x'.
export function profileSubscriptionKey({ sessionKey, leadId, attempt }) {
  if (!sessionKey || !isValidLeadId(leadId)) return null;
  return JSON.stringify([sessionKey, leadId, attempt]);
}

// Próxima resposta guardada, a partir da anterior e do doc que chegou (lead
// normalizado ou null). Só é "excluída" quando ESTA chave já mostrou a ficha:
// o doc estava na tela e sumiu. Guarda o último lead para o Voltar saber se a
// pessoa era cliente (volta para Clientes) ou lead (volta para o Pipeline).
// Doc ausente que veio só do cache (fromCache, sem internet) é erro de conexão,
// e não "não encontrada": o servidor ainda não disse que o doc não existe.
export function nextProfileSnap(prev, key, lead, { fromCache = false } = {}) {
  if (lead) return { key, status: 'ready', lead };
  const wasShown = prev?.key === key && (prev.status === 'ready' || prev.status === 'deleted');
  if (wasShown) return { key, status: 'deleted', lead: prev.lead ?? null };
  if (fromCache) return { key, status: 'error', lead: null };
  return { key, status: 'missing', lead: null };
}

// Status que vale neste render. Resposta de outra chave conta como "loading":
// é assim que o hook não precisa zerar estado dentro do effect.
export function profileStatusFor({ leadId, sessionKey, key, snap }) {
  if (!isValidLeadId(leadId)) return 'invalid';
  if (!sessionKey || !key) return 'waiting';
  if (!snap || snap.key !== key) return 'loading';
  return snap.status;
}

// O que a rota desenha. A ficha pronta espera os catálogos da academia
// (dataReady), senão mostraria cliente sem contrato e etapa sem cor por um
// instante. "Não encontrada", "excluída" e erro aparecem sem esperar.
export function resolveFichaView({ status, dataReady, deleting }) {
  if (deleting) return 'deleting';
  if (status === 'invalid' || status === 'missing') return 'missing';
  if (status === 'deleted' || status === 'error') return status;
  if (status === 'ready' && dataReady) return 'ready';
  return 'loading';
}
