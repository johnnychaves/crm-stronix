import { useEffect, useRef } from 'react';

// Os atalhos do bloco Agora da Meta nova (PR 4 do plano da Meta): W abre o
// WhatsApp, L liga, C marca Compareceu ou conclui, N marca Não compareceu e S
// pula. `acoes` é um objeto { w, l, c, n, s } com a função de cada tecla, ou
// null quando a tecla não vale para a tarefa do Agora.
//
// O atalho fica calado quando:
// - há janela, balão ou menu aberto (a mesma conferência do hasUnsavedWork,
//   mais o menu e a lista, que usam as letras para achar o item);
// - o foco está num campo de texto;
// - Ctrl, Cmd ou Alt estão apertados, ou a tecla está sendo segurada.

// Todo contenteditable que não seja "false" (inclui o plaintext-only e os filhos
// de um editor, pelo closest).
const EDITAVEL = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const ABERTO = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

export function atalhoBloqueado(e, doc = document) {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return true;
  const alvo = e.target;
  if (alvo && typeof alvo.closest === 'function' && alvo.closest(EDITAVEL)) return true;
  return Boolean(doc.querySelector(ABERTO));
}

export function useAgoraShortcuts(acoes) {
  const atual = useRef(acoes);
  useEffect(() => {
    atual.current = acoes;
  });

  useEffect(() => {
    const onKey = (e) => {
      if (typeof e.key !== 'string' || atalhoBloqueado(e)) return;
      const acao = atual.current?.[e.key.toLowerCase()];
      if (!acao) return;
      e.preventDefault();
      acao();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
