import { useState } from 'react';
import { getKanbanAvatarPalette, getKanbanInitials } from '../../lib/kanban.js';

function KanbanAvatar({ name = '', size = 32 }) {
  const [bg, fg] = getKanbanAvatarPalette(name);
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 ring-1 ring-black/5"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}
    >
      {getKanbanInitials(name)}
    </div>
  );
}

const initials = (name) =>
  (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const AVATAR_PALETTES = [
  ['#fde68a', '#92400e'],
  ['#bbf7d0', '#065f46'],
  ['#bae6fd', '#075985'],
  ['#fbcfe8', '#9d174d'],
  ['#ddd6fe', '#5b21b6'],
  ['#fecaca', '#9f1212'],
  ['#a7f3d0', '#065f46'],
  ['#fef08a', '#854d0e']
];

const avatarTone = (seed) => {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
};

// `photoUrl` opcional: quando presente, mostra a foto (object-cover) no lugar
// das iniciais; se a imagem falhar ao carregar (URL expirada/quebrada), cai de
// volta pras iniciais via onError. Sem photoUrl, comportamento idêntico ao antigo.
function Avatar({ name, size = 36, photoUrl = null }) {
  const [bg, fg] = avatarTone(name);
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !failed;
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 ring-1 ring-black/[0.04] overflow-hidden"
      style={{ width: size, height: size, background: showPhoto ? 'transparent' : bg, color: fg, fontSize: size * 0.36 }}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={name || ''}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
export { Avatar, KanbanAvatar };
