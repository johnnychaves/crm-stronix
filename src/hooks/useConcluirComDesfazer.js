import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// O aviso com Desfazer da Meta nova (PR 4 do plano da Meta). Concluir um Novo
// lead não pede mais a caixa de confirmação do navegador: a tarefa sai da tela
// na hora, o aviso mostra o "Desfazer" e a gravação só acontece quando o prazo
// passa. Desfazer dentro do prazo não grava nada.
//
// Grava antes do prazo quando:
// - outra ação pede o aviso (fica um aviso por vez, e o anterior é gravado);
// - a aba fecha ou recarrega (pagehide);
// - a pessoa sai da tela (a tela desmonta).
// Uma queda do navegador dentro do prazo perde a conclusão: é o risco aceito
// no plano.
//
// Cada pendência é { texto, esconder, gravar, desfazer }: `esconder` é a chave
// da tarefa que sai da tela, `gravar` roda no fim do prazo e `desfazer`
// (opcional) roda no clique do Desfazer. A tarefa continua escondida enquanto a
// promessa do `gravar` não termina: a marca do dia chega pela assinatura antes
// da resposta do servidor, então a tarefa não pisca de volta na fila. Se a
// gravação falhar, ela volta; quem avisa do erro é o próprio `gravar`.
//
// O prazo para enquanto o mouse ou o foco do teclado estão no aviso
// (`segurar`), para quem vai clicar no Desfazer não perder o botão no caminho,
// e recomeça inteiro quando os dois saem.

export const DESFAZER_MS = 6000;

export function useConcluirComDesfazer(prazo = DESFAZER_MS) {
  const [pendente, setPendente] = useState(null);
  const [gravando, setGravando] = useState([]);
  const atual = useRef(null);
  const timer = useRef(null);
  const seguras = useRef(new Set());

  const encerrar = useCallback((rodar) => {
    const p = atual.current;
    if (!p) return;
    clearTimeout(timer.current);
    // O aviso some sem disparar o mouseleave e o blur: quem segurava solta.
    seguras.current.clear();
    atual.current = null;
    setPendente(null);
    rodar(p);
  }, []);

  const gravarAgora = useCallback(() => encerrar((p) => {
    const feito = p.gravar();
    if (!feito || typeof feito.then !== 'function') return;
    setGravando((g) => [...g, p.esconder]);
    const soltar = () => setGravando((g) => {
      const i = g.indexOf(p.esconder);
      return i < 0 ? g : [...g.slice(0, i), ...g.slice(i + 1)];
    });
    feito.then(soltar, soltar);
  }), [encerrar]);

  const desfazer = useCallback(() => encerrar((p) => p.desfazer?.()), [encerrar]);

  const contar = useCallback(() => {
    clearTimeout(timer.current);
    if (atual.current && seguras.current.size === 0) timer.current = setTimeout(gravarAgora, prazo);
  }, [gravarAgora, prazo]);

  const agendar = useCallback((item) => {
    gravarAgora();
    atual.current = item;
    setPendente(item);
    contar();
  }, [gravarAgora, contar]);

  // `motivo` é 'mouse' ou 'foco'; o prazo só corre sem nenhum dos dois.
  const segurar = useCallback((motivo, ligado) => {
    if (ligado) seguras.current.add(motivo);
    else seguras.current.delete(motivo);
    contar();
  }, [contar]);

  useEffect(() => {
    window.addEventListener('pagehide', gravarAgora);
    return () => {
      window.removeEventListener('pagehide', gravarAgora);
      gravarAgora();
    };
  }, [gravarAgora]);

  const escondidas = useMemo(() => (pendente ? [pendente.esconder, ...gravando] : gravando), [pendente, gravando]);
  return { pendente, escondidas, agendar, gravarAgora, desfazer, segurar };
}
