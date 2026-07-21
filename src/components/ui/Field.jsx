import React from 'react';

function Field({ label, hint, children, error, required }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {label}
          {required && <span className="text-accent-500 normal-case text-[12px] leading-none">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11.5px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-[11.5px] text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  );
}

const StyledInput = React.forwardRef(function StyledInput({ icon, className = '', ...p }, ref) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        {...p}
        className={`w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:focus:border-white/20 outline-none text-[13px] ${icon ? 'pl-9' : 'pl-3'} pr-3 placeholder:text-slate-400 transition ${className}`}
      />
    </div>
  );
});

function StyledSelect({ children, className = '', ...p }) {
  return (
    <select
      {...p}
      className={`w-full h-10 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:focus:border-white/20 outline-none text-[13px] pl-3 pr-8 transition appearance-none cursor-pointer ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'><path d='M3 5l3 3 3-3'/></svg>")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right .7rem center'
      }}
    >
      {children}
    </select>
  );
}
export { Field, StyledInput, StyledSelect };
