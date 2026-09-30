import { AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Os avisos das telas de entrada (login e "Esqueci a senha"). As duas regiões
// ficam sempre montadas: sem mensagem elas são sr-only e vazias, porque o
// leitor de tela só anuncia o que aparece numa região que já estava na página.
//
// O className só entra quando há mensagem, para a margem de quem usa não ficar
// numa região escondida. O id vai para a região com ou sem mensagem, para um
// aria-describedby poder apontar para ela.
const ALERT_BOX = 'flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300';
const STATUS_BOX = 'flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3.5 py-2.5 text-[12.5px] text-emerald-700 dark:text-emerald-300';

// Erro que não é de um campo só, como o de e-mail ou senha do login.
function AuthAlert({ message, className, id }) {
  return (
    <div id={id} role="alert" className={cn(message ? [ALERT_BOX, className] : 'sr-only')}>
      {message && <AlertTriangle className="size-[15px] mt-px shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// Aviso que não é erro, como o de código reenviado e o de senha nova salva.
function AuthStatus({ message, className, id }) {
  return (
    <div id={id} role="status" className={cn(message ? [STATUS_BOX, className] : 'sr-only')}>
      {message && <CheckCircle className="size-[15px] mt-px shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

export { AuthAlert, AuthStatus };
