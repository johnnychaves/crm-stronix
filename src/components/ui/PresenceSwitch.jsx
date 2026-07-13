import { cn } from '@/lib/utils';

// Switch de presença (estilo iOS) — sem texto, só cor + posição do knob:
//   knob à ESQUERDA + trilho VERDE  = veio (attended)
//   knob à DIREITA  + trilho VERMELHO = faltou (no_show)
//   knob no CENTRO  + trilho cinza    = ainda não confirmado (pending)
// A metade esquerda do trilho confirma "veio", a direita "faltou". `highlight`
// acende um anel laranja (janela de 15min pós-horário, na tela de Aulas).
export function PresenceSwitch({ attKey, saving = false, highlight = false, onMark }) {
  const isVeio = attKey === 'attended';
  const isFaltou = attKey === 'no_show';

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

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Confirmar presença"
      className={cn(
        'relative inline-flex shrink-0 rounded-full transition-shadow',
        highlight && 'ring-2 ring-accent-500/35'
      )}
    >
      <div className={cn('relative w-[46px] h-[26px] rounded-full transition-colors', track, saving && 'opacity-60')}>
        <span
          className={cn(
            'absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.35)] transition-[left,transform] duration-200',
            knobPos
          )}
        />
      </div>
      {/* Zonas clicáveis invisíveis: esquerda = veio, direita = faltou. */}
      <button
        type="button"
        disabled={saving}
        onClick={(e) => onMark('attended', e)}
        aria-label="Marcar que veio"
        aria-pressed={isVeio}
        title="Veio"
        className="absolute inset-y-0 left-0 w-1/2 rounded-l-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-default"
      />
      <button
        type="button"
        disabled={saving}
        onClick={(e) => onMark('no_show', e)}
        aria-label="Marcar que faltou"
        aria-pressed={isFaltou}
        title="Faltou"
        className="absolute inset-y-0 right-0 w-1/2 rounded-r-full focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 disabled:cursor-default"
      />
    </div>
  );
}
