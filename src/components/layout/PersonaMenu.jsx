import { Building2, CreditCard, LogOut, Shield, User } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '../ui/dropdown-menu.jsx';

// Menu da conta no canto superior direito (ícone de persona). Reúne o perfil da
// academia + Plano & faturas (só para o admin) e o logout. Consultor vê apenas
// a própria identidade + Sair. Super-admin puro não tem academia → sem perfil.
function PersonaMenu({ appUser, isAdmin, onProfile, onBilling, onLogout }) {
  const superOnly = !!appUser?.superAdminOnly;
  const role = superOnly ? 'Super-admin' : isAdmin ? 'Acesso Master' : 'Consultor';
  const RoleIcon = superOnly ? Shield : isAdmin ? Shield : User;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Sua conta"
          className="rounded-full transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
        >
          <Avatar name={appUser?.name} size={36} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name={appUser?.name} size={38} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold truncate text-slate-900 dark:text-white">{appUser?.name || 'Conta'}</div>
            <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <RoleIcon className="w-3 h-3" /> {role}
            </div>
          </div>
        </div>
        {isAdmin && !superOnly && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onProfile} className="cursor-pointer">
              <Building2 className="size-4 text-slate-500" /> Perfil da academia
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBilling} className="cursor-pointer">
              <CreditCard className="size-4 text-slate-500" /> Plano &amp; faturas
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-400">
          <LogOut className="size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { PersonaMenu };
