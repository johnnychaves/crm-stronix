const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

const mapping = [
  { light: 'bg-white', dark: 'dark:bg-neutral-900' },
  { light: 'bg-\\[#eaedf2\\]', dark: 'dark:bg-neutral-950' },
  { light: 'bg-\\[#f4f5f7\\]', dark: 'dark:bg-neutral-900' },
  { light: 'bg-gray-50', dark: 'dark:bg-neutral-950' },
  { light: 'bg-gray-100', dark: 'dark:bg-neutral-800' },
  { light: 'bg-gray-200', dark: 'dark:bg-neutral-700' },
  { light: 'text-gray-900', dark: 'dark:text-white' },
  { light: 'text-gray-800', dark: 'dark:text-neutral-200' },
  { light: 'text-gray-700', dark: 'dark:text-neutral-300' },
  { light: 'text-gray-600', dark: 'dark:text-neutral-400' },
  { light: 'text-gray-500', dark: 'dark:text-neutral-400' },
  { light: 'text-gray-400', dark: 'dark:text-neutral-500' },
  { light: 'border-gray-200', dark: 'dark:border-neutral-800' },
  { light: 'border-gray-300', dark: 'dark:border-neutral-700' }
];

mapping.forEach(({ light, dark }) => {
  // Use a regex to match the light class when it's NOT already followed by its dark counterpart
  // and NOT already part of a dark variant itself.
  // We match word boundaries or whitespace.
  const regex = new RegExp(`(?<!dark:)\\b${light}\\b(?!\\s+${dark})`, 'g');
  content = content.replace(regex, `${light.replace(/\\/g, '')} ${dark}`);
});

fs.writeFileSync('src/App.jsx', content);
console.log('Added dark mode variants to App.jsx');
