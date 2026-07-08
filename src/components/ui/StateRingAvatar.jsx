import { Avatar } from './Avatar.jsx';
import { getTone } from '../../lib/leadState.js';

// Avatar compacto com o ANEL do estado de ciclo de vida (lead/cliente).
// Apresentacional: recebe toneName/splitHex prontos (mesma convenção do
// RingAvatar do perfil), sem glow nem dot para caber numa linha de lista.
// splitHex presente = anel dividido (metade tom, metade splitHex) do "a vencer".
function StateRingAvatar({ name, toneName = 'brand', splitHex = null, size = 32 }) {
  const baseHex = getTone(toneName).hex;
  const ring = splitHex
    ? `conic-gradient(${baseHex} 0deg 180deg, ${splitHex} 180deg 360deg)`
    : baseHex;
  return (
    <span className="relative shrink-0 rounded-full" style={{ background: ring, padding: 2.5 }}>
      <span className="block rounded-full bg-white dark:bg-neutral-900" style={{ padding: 2 }}>
        <Avatar name={name} size={size} />
      </span>
    </span>
  );
}

export { StateRingAvatar };
