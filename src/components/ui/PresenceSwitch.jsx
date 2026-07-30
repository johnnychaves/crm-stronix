import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Switch de presença (estilo iOS) — sem texto, só cor + posição do knob:
//   knob à ESQUERDA + trilho VERDE    = veio (attended)
//   knob à DIREITA  + trilho VERMELHO = faltou (no_show)
//   knob no CENTRO  + trilho cinza    = ainda não confirmado (pending)
//
// INTERAÇÃO (decisão do Johnny, 2026-07-30): o clique vale em QUALQUER ponto do
// botão e ALTERNA o estado. Não existe mais metade esquerda / metade direita —
// era fácil errar o lado numa lista densa. Em branco vira "veio" (o caso comum
// no balcão), "veio" vira "faltou", "faltou" vira "veio".
//
// Para DESMARCAR (voltar ao branco), segure o botão pressionado por meio
// segundo. É gesto escondido de propósito, para não gastar espaço na linha —
// precisa ser avisado ao time, senão ninguém descobre.
//
// `highlight` acende um anel laranja (janela de 15min pós-horário, tela de Aulas).
//
// onMark(next, event) recebe 'attended', 'no_show' ou null (null = desmarcar).

const HOLD_MS = 550;

export function PresenceSwitch({ attKey, saving = false, highlight = false, onMark }) {
  const isVeio = attKey === 'attended';
  const isFaltou = attKey === 'no_show';
  const marcado = isVeio || isFaltou;

  // `held` marca que o "segurar" já resolveu, para o clique que vem logo depois
  // de soltar não alternar por cima do desmarcar.
  const held = useRef(false);
  const timer = useRef(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const handlePointerDown = () => {
    if (saving) return;
    held.current = false;
    clearTimer();
    // Só faz sentido segurar quando existe marca para desfazer.
    if (!marcado) return;
    timer.current = setTimeout(() => {
      held.current = true;
      timer.current = null;
      onMark(null);
    }, HOLD_MS);
  };

  const handleClick = (e) => {
    clearTimer();
    if (held.current) {
      held.current = false; // o segurar já desmarcou; ignora este clique
      return;
    }
    if (saving) return;
    onMark(isVeio ? 'no_show' : 'attended', e);
  };

  const track = isVeio
    ? 'bg-emerald-500'
    : isFaltou
      ? 'bg-rose-500'
      : 'bg-slate-200 dark:bg-neutral-700';

  const knobPos = isVeio
    ? 'left-[3px]'
    : isFaltou
      ? 'left-[calc(100%-23px)]'
      : 'left-1/2 -translate-x-1/2';

  const label = isVeio ? 'Veio' : isFaltou ? 'Faltou' : 'Confirmar presença';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative inline-flex shrink-0 rounded-full transition-shadow',
        highlight && 'ring-2 ring-accent-500/35'
      )}
    >
      <button
        type="button"
        disabled={saving}
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        aria-label={marcado ? `${label} — clique para alternar, segure para desmarcar` : 'Marcar que veio'}
        title={marcado ? 'Clique alterna · segure para desmarcar' : 'Clique para marcar que veio'}
        className={cn(
          'relative w-[46px] h-[26px] rounded-full transition-colors select-none touch-manipulation',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 disabled:cursor-default',
          track,
          saving && 'opacity-60'
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.35)] transition-[left,transform] duration-200',
            knobPos
          )}
        />
      </button>
    </div>
  );
}
