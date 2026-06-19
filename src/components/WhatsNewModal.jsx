import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { latestUnseenAnnouncement, markAnnouncementSeen } from '../lib/announcements.js';
import { Sparkles, ArrowRight, Check } from 'lucide-react';

// Pop-up de NOVIDADES — mostra o anúncio mais recente que o usuário ainda não
// viu (rastreado por usuário no localStorage). Conteúdo em lib/announcements.js.
// `onConfigure` (opcional, só admin) leva às Configurações.
function WhatsNewModal({ appUser, onConfigure }) {
  // Marca dispensados nesta sessão (além do localStorage) — o useMemo reavalia
  // e o anúncio sai. (Só usuários da academia, não o superadmin interno.)
  const [dismissed, setDismissed] = useState(() => new Set());
  const ann = useMemo(() => {
    if (!appUser?.id || appUser.superAdminOnly) return null;
    const a = latestUnseenAnnouncement(appUser);
    return a && !dismissed.has(a.id) ? a : null;
  }, [appUser, dismissed]);

  if (!ann) return null;
  const isAdmin = appUser?.role === 'admin';

  const close = (id) => { markAnnouncementSeen(appUser, id); setDismissed(s => new Set(s).add(id)); };
  const dismiss = () => close(ann.id);
  const configure = () => { close(ann.id); onConfigure?.(); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <span className="inline-flex items-center gap-1.5 self-start text-[11px] font-bold uppercase tracking-[0.12em] text-accent-600 dark:text-accent-400">
            <Sparkles size={13} /> {ann.eyebrow}
          </span>
          <DialogTitle className="font-display tracking-tight text-[20px] text-slate-900 dark:text-white">{ann.title}</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">{ann.summary}</DialogDescription>
        </DialogHeader>

        {ann.points?.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ann.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-200">
                <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" /> {p}
              </li>
            ))}
          </ul>
        )}

        {isAdmin && ann.adminSteps?.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Como configurar</div>
            <ol className="flex flex-col gap-1 list-decimal list-inside text-[12.5px] text-slate-700 dark:text-slate-200">
              {ann.adminSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>Entendi</Button>
          {isAdmin && onConfigure && (
            <Button onClick={configure}>Configurar agora <ArrowRight size={15} /></Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { WhatsNewModal };
