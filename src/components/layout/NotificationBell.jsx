import { useMemo, useState } from 'react';
import { Bell, Handshake, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { ANNOUNCEMENTS } from '../../lib/announcements.js';
import { buildNotificationFeed } from '../../lib/notifications.js';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover.jsx';

// Sino do header: novidades do sistema e indicações que chegaram pelo link.
// O ícone é neutro como os vizinhos (🎓 e tema); quem chama atenção é o
// contador. As indicações saem dos leads que o app já tem em memória, então o
// sino não custa leitura nenhuma.

const relTime = (date) => {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  return date.toLocaleDateString('pt-BR');
};

function GroupLabel({ children }) {
  return (
    <div className="px-3.5 pt-3 pb-1 text-[9.5px] font-bold uppercase tracking-[.1em] text-slate-400 dark:text-slate-500">
      {children}
    </div>
  );
}

function Row({ icon, tone, title, subtitle, time, unread, action, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
    >
      {unread && <span className="absolute left-1 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
      <span className={cn('size-8 rounded-[10px] grid place-items-center shrink-0', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold leading-snug text-slate-900 dark:text-white">{title}</span>
        {subtitle && <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{subtitle}</span>}
        {action && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300 mt-1">
            {action} <ArrowRight size={11} />
          </span>
        )}
        {time && <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{time}</span>}
      </span>
    </button>
  );
}

export function NotificationBell({ appUser, leads, seenIds, lastSeenReferralsAt, onMarkAllSeen, onOpenArticle }) {
  const [open, setOpen] = useState(false);
  const { openProfile } = useLeadProfile();

  const { news, referrals, unreadCount } = useMemo(
    () => buildNotificationFeed({
      announcements: ANNOUNCEMENTS, appUser, leads, seenIds, lastSeenReferralsAt, now: new Date()
    }),
    [appUser, leads, seenIds, lastSeenReferralsAt]
  );

  const vazio = news.length === 0 && referrals.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Novidades e avisos"
          aria-label={unreadCount > 0 ? `Novidades e avisos, ${unreadCount} sem ler` : 'Novidades e avisos'}
          className={cn(
            'relative size-9 grid place-items-center rounded-xl transition text-slate-500 dark:text-neutral-400',
            'hover:bg-gray-100 dark:hover:bg-neutral-800',
            open && 'bg-gray-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200'
          )}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent-500 text-white text-[9.5px] font-bold grid place-items-center num ring-2 ring-white dark:ring-neutral-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] p-0 rounded-2xl border-slate-200 dark:border-white/[0.08] shadow-[0_20px_48px_-14px_rgba(2,6,23,.3)] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06]">
          <span className="font-display text-[13.5px] font-bold tracking-tight">Novidades e avisos</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllSeen}
              className="text-[11px] font-semibold text-brand-600 dark:text-brand-300 hover:underline"
            >
              Marcar tudo como lido
            </button>
          )}
        </div>

        <div className="max-h-[min(26rem,60vh)] overflow-y-auto custom-scrollbar">
          {vazio && (
            <p className="px-3.5 py-8 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
              Nada por aqui ainda. Novidades do sistema e indicações pelo link aparecem neste espaço.
            </p>
          )}

          {news.length > 0 && <GroupLabel>Novidades do sistema</GroupLabel>}
          {news.map((n) => (
            <Row
              key={n.id}
              icon={<Sparkles size={15} />}
              tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/12 dark:text-indigo-300"
              title={n.title}
              subtitle={n.summary}
              time={n.at ? relTime(n.at) : null}
              unread={n.unread}
              action={n.articleId ? 'Ver como funciona' : null}
              onClick={() => {
                setOpen(false);
                if (n.articleId) onOpenArticle?.(n.articleId);
              }}
            />
          ))}

          {referrals.length > 0 && <GroupLabel>Indicações que chegaram pelo link</GroupLabel>}
          {referrals.map((r) => (
            <Row
              key={r.id}
              icon={<Handshake size={15} />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300"
              title={`${r.name} entrou por indicação`}
              subtitle={[r.referredByName ? `Indicado por ${r.referredByName}` : null, r.modalidade]
                .filter(Boolean).join(' · ') || null}
              time={relTime(r.at)}
              unread={r.unread}
              onClick={() => { setOpen(false); openProfile(r.id); }}
            />
          ))}
        </div>

        {referrals.length > 0 && (
          <div className="border-t border-slate-100 dark:border-white/[0.06] py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
            {appUser?.role === 'admin' ? 'Você vê as indicações da academia' : 'Você vê as indicações da sua carteira'}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
