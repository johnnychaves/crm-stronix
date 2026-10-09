// Versão nova na volta da pausa por inatividade.
//
// O Stronilead roda numa aba que fica aberta o dia inteiro, com o login salvo,
// e o navegador só troca o código quando a página recarrega. Um deploy às 10h
// só chegava a quem desse F5 (hard refresh não é preciso: o index.html vem com
// must-revalidate e não há service worker). Em 09/10/2026 a Shape One estava
// sem o menu Rotinas, publicado no dia anterior.
//
// Agora, na volta de uma pausa de 15 minutos (src/lib/activityGate.js), o app
// pergunta qual versão está publicada (o version.json que o build gera, em
// vite.config.js) e recarrega quando ela é outra. Não recarrega com trabalho
// pela metade na tela, e não recarrega enquanto ninguém está olhando: de
// madrugada a recarga faria o Firestore ler tudo de novo à toa, e na volta a
// leitura acontece de qualquer jeito. A volta espera a resposta antes de
// religar as assinaturas, para a recarga não somar uma segunda leitura.

// Marca, no sessionStorage, a versão pela qual esta aba já recarregou. Se
// depois da recarga a aba continua na versão antiga (cache no caminho), ela
// não recarrega de novo pela mesma versão.
export const RELOAD_MARK_KEY = 'stronilead:recarregou-para';

// Tempo para o version.json responder. Sem resposta, a volta segue sem recarga.
export const RELEASE_TIMEOUT_MS = 3000;

export function shouldReload({ current, remote, triedFor, unsaved }) {
  if (!current || current === 'dev') return false;
  if (!remote || remote === current) return false;
  if (triedFor === remote) return false;
  return !unsaved;
}

// Campos em que a pessoa digita. Data, caixa de marcar e campo escondido têm
// valor o tempo todo e não são trabalho pela metade.
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'tel', 'email', 'url', 'number']);

// Trabalho pela metade: janela aberta (diálogo, confirmação, balão) ou texto
// digitado em algum campo, como a anotação da ficha, que não é janela. Campo
// preenchido que não é rascunho (uma busca, um formulário de Configurações)
// também segura: no pior caso a versão nova espera a próxima volta.
export function hasUnsavedWork(doc) {
  if (!doc) return true;
  if (doc.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  for (const el of doc.querySelectorAll('textarea, input')) {
    if (el.disabled || el.readOnly) continue;
    if (el.tagName === 'INPUT' && !TEXT_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase())) continue;
    if (String(el.value ?? '').trim()) return true;
  }
  return false;
}

// A versão publicada, ou null quando não deu para saber. Arquivo que não
// existe vira o index.html com 200 (vercel.json), e aí o JSON falha e dá null.
export async function fetchRelease(fetchImpl, timeoutMs = RELEASE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl('/version.json', { cache: 'no-store', signal: controller.signal });
    if (!res?.ok) return null;
    const body = await res.json();
    return typeof body?.release === 'string' && body.release ? body.release : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
