// O que os pop-ups da Meta Diária dividem e não é componente: o teclado dos
// grupos de rádio feitos de botões e a classe dos campos.

// Setas, Home e End num grupo de rádio de botões (role="radio" dentro de
// role="radiogroup"): a seta anda e já escolhe, como no rádio nativo, e o foco
// vai junto. Os botões ficam na ordem de `ids`.
export function onRadioKeyDown(e, ids, current, pick) {
  const n = ids.length;
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  const at = ids.indexOf(current);
  let i;
  if (step) i = at < 0 ? (step > 0 ? 0 : n - 1) : (at + step + n) % n;
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = n - 1;
  else return;
  e.preventDefault();
  pick(ids[i]);
  e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll('[role="radio"]')[i]?.focus();
}

// Só a opção escolhida fica no Tab; sem escolha, a primeira.
export const radioTabIndex = (id, ids, current) => (id === (ids.includes(current) ? current : ids[0]) ? 0 : -1);

// Campo de texto, data, hora e lista dos pop-ups. O color-scheme escuro faz o
// seletor nativo de data e hora abrir escuro no tema escuro.
export const POPUP_FIELD = 'h-10 rounded-xl border border-border bg-card px-3 text-[14px] text-foreground outline-none transition focus-visible:anel-foco dark:[color-scheme:dark]';
