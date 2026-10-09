// O `beforeResume` do useActivityGate que recarrega a página quando saiu versão
// nova. A regra e o porquê moram em src/lib/appUpdate.js; aqui é só a fiação
// com o navegador (fetch, sessionStorage e location).
//
// As opções existem para o teste. O App chama sem nada.
import { useCallback } from 'react';
import { shouldReload, hasUnsavedWork, fetchRelease, RELOAD_MARK_KEY } from '../lib/appUpdate.js';

// A versão deste build: o commit que a Vercel publicou (vite.config.js).
const CURRENT_RELEASE = import.meta.env.VITE_APP_RELEASE;

// O sessionStorage pode falhar (aba anônima, dados bloqueados). Sem a marca,
// no pior caso a aba tenta de novo na próxima volta.
const readMark = () => {
  try { return sessionStorage.getItem(RELOAD_MARK_KEY); } catch { return null; }
};
const writeMark = (release) => {
  try { sessionStorage.setItem(RELOAD_MARK_KEY, release); } catch { /* segue sem a marca */ }
};
const reloadPage = () => window.location.reload();

export function useReloadOnUpdate({ current = CURRENT_RELEASE, fetchImpl, reload = reloadPage } = {}) {
  return useCallback(async (resume) => {
    let reloading = false;
    try {
      const remote = await fetchRelease(fetchImpl ?? globalThis.fetch);
      if (shouldReload({ current, remote, triedFor: readMark(), unsaved: hasUnsavedWork(document) })) {
        writeMark(remote);
        reloading = true;
        reload();
      }
    } catch {
      // Qualquer falha aqui deixa a pessoa na versão de agora.
    }
    if (!reloading) resume();
  }, [current, fetchImpl, reload]);
}
