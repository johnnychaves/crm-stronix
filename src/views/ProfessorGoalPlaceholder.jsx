import { CalendarClock, Link2Off } from 'lucide-react';

// Meta diária do professor até a Meta dos faltosos chegar (PR 3 da spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "A Meta do
// professor"). O professor não tem a Meta do consultor: nada de lead,
// renovação ou volume. Sem professor do cadastro ligado ao login, a tela diz o
// que fazer, porque a lista dele depende dessa ligação.
export function ProfessorGoalPlaceholder({ appUser }) {
  const ligado = typeof appUser?.professorId === 'string' && appUser.professorId.trim() !== '';
  const Icone = ligado ? CalendarClock : Link2Off;
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center text-card-foreground shadow-card">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icone className="size-6" />
      </span>
      <h2 className="font-display text-[22px] font-bold tracking-tight">Meta diária</h2>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
        {ligado
          ? 'Sua lista de faltosos aparece aqui depois da primeira importação.'
          : 'Seu acesso ainda não está ligado a um professor. Fale com o gestor.'}
      </p>
    </section>
  );
}
