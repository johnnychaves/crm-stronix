import { Building2, CreditCard, GraduationCap, LogOut, Moon, Shield, Sun, User } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '../ui/dropdown-menu.jsx';
import { AppLink } from '../nav/AppLink.jsx';

// Menu da conta no canto superior direito (ícone de persona). Reúne o perfil da
// academia + Plano & faturas (só para o admin) e o logout. Consultor vê apenas
// a própria identidade + Sair. Super-admin puro não tem academia → sem perfil.
// Perfil da academia e Plano & faturas são links (profileHref e billingHref,
// montados pelo App com a academia da sessão): Ctrl+clique abre em outra aba.
// O item do menu empresta o papel e o foco ao link (asChild) e fecha o menu no
// clique. Enter pelo teclado abre na mesma aba.
function PersonaMenu({ appUser, isAdmin, profileHref, billingHref, onLogout, onHelp, onToggleTheme, isDarkMode }) {
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
        {isAdmin && !superOnly && (profileHref || billingHref) && (
          <>
            <DropdownMenuSeparator />
            {profileHref && (
              <DropdownMenuItem asChild className="cursor-pointer">
                <AppLink to={profileHref}>
                  <Building2 className="size-4 text-slate-500" /> Perfil da academia
                </AppLink>
              </DropdownMenuItem>
            )}
            {billingHref && (
              <DropdownMenuItem asChild className="cursor-pointer">
                <AppLink to={billingHref}>
                  <CreditCard className="size-4 text-slate-500" /> Plano &amp; faturas
                </AppLink>
              </DropdownMenuItem>
            )}
          </>
        )}
        {/* No celular o header não comporta 🎓 + tema + sino, então esses dois
            moram aqui. No desktop continuam como ícones do topo. */}
        <DropdownMenuSeparator className="sm:hidden" />
        {onHelp && (
          <DropdownMenuItem onClick={onHelp} className="cursor-pointer sm:hidden">
            <GraduationCap className="size-4 text-slate-500" /> Central de ajuda
          </DropdownMenuItem>
        )}
        {onToggleTheme && (
          <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer sm:hidden">
            {isDarkMode ? <Sun className="size-4 text-slate-500" /> : <Moon className="size-4 text-slate-500" />}
            {isDarkMode ? 'Tema claro' : 'Tema escuro'}
          </DropdownMenuItem>
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
