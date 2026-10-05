import { PowerOff } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { SurgeMark, StronileadWordmark } from '../../components/brand/SurgeMark.jsx';

// Tela de quem é professor numa academia com o módulo "Professor e faltosos"
// desligado (professorAccessOff, em src/lib/sidebarNav.js). O login vale, mas
// nenhuma tela é dele: só resta o aviso e o Sair. Ligar o módulo de novo
// devolve as telas no próximo login ou F5. Como a TenantBlockedScreen, ela é
// desenhada no lugar do app inteiro, sem menu e sem cabeçalho.
export function ProfessorAccessOffScreen({ onLogout }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-card-lg">
        <div className="flex items-center justify-center gap-2">
          <SurgeMark size={26} />
          <StronileadWordmark className="text-[18px] text-foreground" />
        </div>
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <PowerOff className="size-7" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">Acesso desligado</h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          O acesso de professor está desligado nesta academia. Fale com o gestor.
        </p>
        <Button type="button" size="lg" className="mt-3 w-full" onClick={onLogout}>Sair</Button>
      </section>
    </main>
  );
}
