import { createContext, useContext, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Leva o id do texto do rótulo até o AuthInput. Não é exportado: só o par
// AuthField e AuthInput usa.
const LabelIdContext = createContext(undefined);

// O campo das telas de entrada (login e "Esqueci a senha"): rótulo, ícone e o
// input, que vem como children, com a dica e o aviso de erro embaixo.
//
// O nome do input sai só do texto do rótulo (aria-labelledby, no AuthInput). O
// botão de mostrar senha fica dentro do <label> e, sem isso, entraria no nome:
// "Senha Mostrar senha".
//
// O erro fica numa região viva montada desde o primeiro render, porque o
// leitor de tela só anuncia o que aparece numa região que já estava na página.
// A região é educada (polite), não de alerta: a tela leva o foco ao primeiro
// campo com erro, e o leitor lê o erro ali pela descrição. A região espera essa
// leitura terminar em vez de cortá-la, e com vários campos errados um aviso não
// corta o outro.
//
// A dica e o erro só ganham id quando a tela passa hintId e errorId. Quem
// aponta o aria-describedby do input para eles é a tela.
function AuthField({ label, icon: Icon, hint, hintId, error, errorId, children }) {
  const labelId = useId();
  return (
    <LabelIdContext.Provider value={labelId}>
      <div>
        <label className="block">
          <span id={labelId} className="text-[12.5px] font-semibold text-gray-700 dark:text-neutral-300">{label}</span>
          <div
            className={cn(
              'mt-1.5 relative flex items-center rounded-xl border bg-white dark:bg-white/[0.03] transition border-gray-200 dark:border-white/[0.08] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15',
              error && 'border-rose-300 dark:border-rose-500/40 focus-within:border-rose-400 focus-within:ring-rose-500/15',
            )}
          >
            <span aria-hidden="true" className="pl-3.5 text-gray-400 dark:text-neutral-500"><Icon className="size-[17px]" /></span>
            {children}
          </div>
        </label>
        {hint && <p id={hintId} className="mt-1.5 text-[12px] leading-snug text-gray-500 dark:text-neutral-400">{hint}</p>}
        <div aria-live="polite">
          {error && <p id={errorId} className="mt-1.5 text-[12px] font-medium leading-snug text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      </div>
    </LabelIdContext.Provider>
  );
}

// O input das telas de entrada. O className recebido é mesclado pelo cn e vence
// a classe base em conflito (text-lg no lugar do text-[14px], por exemplo). O
// aria-labelledby vem antes do {...props}, então quem chama ainda pode trocá-lo.
function AuthInput({ className, ...props }) {
  const labelId = useContext(LabelIdContext);
  return (
    <input
      aria-labelledby={labelId}
      className={cn(
        'w-full h-12 bg-transparent outline-none text-[14px] px-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500',
        className,
      )}
      {...props}
    />
  );
}

// O botão de mostrar e esconder a senha, que vai dentro do AuthField. O nome
// fica só no aria-label, sem title: o Chrome expõe qualquer title como
// descrição, mesmo igual ao aria-label, e o leitor de tela repete o nome.
function AuthPasswordToggle({ shown, onToggle }) {
  return (
    <span className="pr-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
        className="size-9 grid place-items-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
      >
        {shown ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
      </button>
    </span>
  );
}

export { AuthField, AuthInput, AuthPasswordToggle };
