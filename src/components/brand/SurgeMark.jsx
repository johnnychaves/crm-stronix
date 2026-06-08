// Símbolo: três chevrons ascendentes (funil → conversão → matrícula).
// Os dois inferiores em brand; o topo em accent (laranja) = resultado.
// tone: 'brand' (chevrons em brand-600) | 'onDark' (chevrons brancos).
function SurgeMark({ size = 32, tone = 'brand', className = '' }) {
  const lower = tone === 'onDark' ? '#FFFFFF' : 'var(--color-brand-600)';
  const top = 'var(--color-accent-500)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="STRONILEAD"
      className={className}
    >
      <path d="M11 39 L24 29 L37 39" stroke={lower} strokeWidth="4.4" />
      <path d="M13.5 30 L24 21.5 L34.5 30" stroke={lower} strokeWidth="4.4" />
      <path d="M16 21 L24 14 L32 21" stroke={top} strokeWidth="4.4" />
    </svg>
  );
}

// Wordmark: STRONI (peso 500) + LEAD (peso 700).
// leadOnDark → "LEAD" em brand-300 sobre fundo escuro; senão brand-600.
function StronileadWordmark({ className = '', leadOnDark = false }) {
  return (
    <span className={`font-display tracking-tight leading-none whitespace-nowrap ${className}`}>
      <span className="font-medium">STRONI</span>
      <span className={`font-bold ${leadOnDark ? 'text-brand-300' : 'text-brand-600'}`}>LEAD</span>
    </span>
  );
}
export { SurgeMark, StronileadWordmark };
