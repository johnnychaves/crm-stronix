import { Camera } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Avatar } from '../ui/Avatar.jsx';
import { getTone } from '../../lib/leadState.js';

// Avatar com ANEL de estado do ciclo de vida (lead/cliente) + dot de status +
// glow suave. Reaproveita o Avatar (iniciais sobre pastel) por dentro. O tom
// vem de getTone(toneName); usamos o hex inline para ring/glow (estável p/ a
// JIT do Tailwind) e o ring-offset muda de cor entre claro/escuro.
//
// Ref README "Anel de estado": padding ~4px no wrapper; círculo com ring de
// 2.5px na cor do tom + ring-offset de 3px na cor do card (branco / #0e1326) +
// glow box-shadow 0 0 0 6px <hex ~40% alpha>. Dot ≈26% do diâmetro, cor strong.
function RingAvatar({ name, size = 64, toneName = 'brand', showDot = true, splitHex = null, photoUrl = null, onPhotoClick = null }) {
  const tone = getTone(toneName);
  const hex = tone.hex;
  const dotSize = Math.round(size * 0.26);
  // Com onPhotoClick, o "círculo pequeno" (dot de estado) dá lugar ao botão de
  // câmera — é o gatilho de foto na ficha. Sem a prop, o dot segue como antes.
  const camSize = Math.round(size * 0.34);
  const cameraBtn = (
    <button
      type="button"
      onClick={onPhotoClick}
      aria-label="Alterar foto"
      title="Alterar foto"
      className="absolute bottom-0.5 right-0.5 rounded-full grid place-items-center text-white bg-brand-600 hover:bg-brand-700 ring-2 ring-white dark:ring-[#0e1326] transition"
      style={{ width: camSize, height: camSize }}
    >
      <Camera style={{ width: camSize * 0.55, height: camSize * 0.55 }} />
    </button>
  );

  // Anel + dot DIVIDIDOS (metade laranja/tom, metade verde) para o estado
  // "a vencer": o contrato segue ATIVO (verde), só perto do fim (laranja).
  if (splitHex) {
    const gradient = `conic-gradient(${hex} 0deg 180deg, ${splitHex} 180deg 360deg)`;
    return (
      <div className="relative shrink-0" style={{ padding: 4 }}>
        <div className="rounded-full" style={{ background: gradient, padding: 2.5, boxShadow: `0 0 0 6px ${hex}40` }}>
          <div className="rounded-full bg-white dark:bg-[#0e1326]" style={{ padding: 3 }}>
            <Avatar name={name} size={size} photoUrl={photoUrl} />
          </div>
        </div>
        {onPhotoClick ? cameraBtn : showDot && (
          <span
            className="absolute bottom-0.5 right-0.5 rounded-full ring-2 ring-white dark:ring-[#0e1326]"
            style={{ width: dotSize, height: dotSize, background: gradient }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0" style={{ padding: 4 }}>
      <div
        className={cn(
          'rounded-full ring-[2.5px] ring-offset-[3px]',
          'ring-offset-white dark:ring-offset-[#0e1326]'
        )}
        style={{ '--tw-ring-color': hex, boxShadow: `0 0 0 6px ${hex}66` }}
      >
        <Avatar name={name} size={size} photoUrl={photoUrl} />
      </div>
      {onPhotoClick ? cameraBtn : showDot && (
        <span
          className={cn(
            'absolute bottom-0.5 right-0.5 rounded-full',
            tone.strong,
            'ring-2 ring-white dark:ring-[#0e1326]'
          )}
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  );
}

export { RingAvatar };
