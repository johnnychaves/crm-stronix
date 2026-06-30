import { Dialog, DialogContent } from './ui/dialog.jsx';
import { GraduationCap, Clock } from 'lucide-react';

// Central de TUTORIAIS — ponto de entrada pelo ícone do topo. Hoje é um
// placeholder "em breve"; vira o lar dos tutoriais definitivos da plataforma.
function TutorialsHubModal({ open, onClose }) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]" overlayClassName="z-[200]">
        <div className="flex flex-col items-center px-8 py-10 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
            <GraduationCap size={30} />
          </span>
          <h3 className="mt-5 font-display text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">Tutoriais</h3>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] font-semibold text-muted-foreground">
            <Clock size={13} /> Em breve
          </span>
          <p className="mx-auto mt-4 max-w-[320px] text-[13.5px] leading-relaxed text-muted-foreground">
            Estamos preparando tutoriais completos da plataforma. Em breve eles ficam aqui, sempre à mão.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { TutorialsHubModal };
