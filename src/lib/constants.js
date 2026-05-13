// Static lookup tables used across the app. Kept in a dedicated file so
// they can be imported by any feature module without pulling all of
// App.jsx.

// Tailwind class fragments per color, used by StatusBadge/TagBadge.
export const statusGradientMap = {
  blue: "from-blue-600 to-cyan-500 text-white",
  green: "from-green-600 to-emerald-400 text-white",
  yellow: "from-yellow-500 to-amber-400 text-gray-900",
  red: "from-red-600 to-pink-500 text-white",
  purple: "from-purple-600 to-indigo-500 text-white",
  orange: "from-orange-500 to-amber-500 text-white",
  gray: "from-neutral-600 to-neutral-400 text-white",
  teal: "from-teal-600 to-cyan-600 text-white",
  pink: "from-pink-500 to-rose-400 text-white",
  indigo: "from-indigo-600 to-blue-600 text-white",
  lime: "from-lime-500 to-green-500 text-gray-900"
};
