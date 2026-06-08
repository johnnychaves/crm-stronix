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

function Avatar({ name, size = 36 }) {
  const [bg, fg] = avatarTone(name);
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 ring-1 ring-black/[0.04]"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}
export { Avatar, KanbanAvatar };
