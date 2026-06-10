// Ícones do Console (portados do protótipo). Paths via innerHTML (constantes nossas).
const ICON = {
  overview: '<path d="M3.5 12.5 12 5l8.5 7.5"/><path d="M5.5 11v8h13v-8"/><path d="M10 19v-5h4v5"/>',
  tenants: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
  plans: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  billing: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M7 14h3"/>',
  support: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
  flags: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  logs: '<path d="M4 5h16M4 10h16M4 15h10"/><circle cx="18" cy="16" r="3"/>',
  health: '<path d="M3 12h4l2 6 4-12 2 6h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11M7 11l5 4 5-4"/><path d="M5 20h14"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4L4 5z"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5"/><circle cx="17" cy="7" r="2.4"/><path d="M21 17c-.3-2-1.6-3.4-4-4"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2"/>',
  money: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 9.5h4M9.5 14.5h4"/>',
  churn: '<path d="M3 7l6 6 4-4 7 7"/><path d="M21 16v-4"/>',
  zap: '<path d="M13 3 4 14h6l-1 7 9-11h-6l1-7z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 17.5v.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
};

function Icon({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON[name] || '' }} />
  );
}

export { Icon, ICON };
