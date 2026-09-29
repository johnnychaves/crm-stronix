import { cn } from '@/lib/utils';

// O campo das telas de entrada (login e "Esqueci a senha"): rótulo, ícone e o
// input, que vem como children, com a dica e o aviso de erro embaixo. Quem
// liga o input à dica e ao aviso é a tela, pelo aria-describedby com os ids
// hintId e errorId.
function AuthField({ label, icon: Icon, hint, hintId, error, errorId, children }) {
  return (
    <div>
      <label className="block">
        <span className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">{label}</span>
        <div
          className={cn(
            'mt-1.5 relative flex items-center rounded-xl border bg-white dark:bg-white/[0.03] transition border-gray-200 dark:border-white/[0.08] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15',
            error && 'border-rose-300 dark:border-rose-500/40',
          )}
        >
          <span className="pl-3.5 text-gray-400 dark:text-neutral-500"><Icon className="size-[17px]" /></span>
          {children}
        </div>
      </label>
      {hint && <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-gray-500 dark:text-neutral-400">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-[12px] font-medium leading-snug text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

// O input das telas de entrada, com a mesma classe que o login usava.
function AuthInput({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full h-12 bg-transparent outline-none text-[14px] px-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500',
        className,
      )}
      {...props}
    />
  );
}

export { AuthField, AuthInput };
