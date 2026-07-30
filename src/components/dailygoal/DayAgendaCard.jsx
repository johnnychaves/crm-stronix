import { useState } from 'react';
import { BookOpen, Building2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PresenceSwitch } from '../ui/PresenceSwitch.jsx';
import { DAILY_GOAL_CATEGORIES } from '../../lib/leads.js';

// Agenda do dia compartilhada (painel da Meta Diária). Só apresenta: as linhas
// chegam prontas de computeDayAgenda e o clique sobe para o pai. NÃO conta na
// meta de quem está olhando — quem confirma credita o DONO do lead.

const hourLabel = (d) =>
  d instanceof Date
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';

// Linha secundária: tipo, modalidade, professor e dono, sem repetir o óbvio.
const subtitleOf = (row) => {
  const parts = [];
  if (row.categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE) {
    parts.push('Visita');
    if (row.appointmentUnit) parts.push(row.appointmentUnit);
  } else {
    parts.push(row.appointmentModality || 'Aula exp.');
    if (row.appointmentProfessorName) parts.push(row.appointmentProfessorName);
  }
  parts.push(row.isMine ? 'sua' : `de ${row.ownerName}`);
  if (row.outcomeByName) parts.push(`conf. ${row.outcomeByName}`);
  return parts.join(' · ');
};

export function DayAgendaCard({ rows, pending, nextIndex, savingId, onMark }) {
  const [filter, setFilter] = useState('pending');
  if (!rows || rows.length === 0) return null;

  const visible = filter === 'pending' ? rows.filter((r) => !r.outcome) : rows;
  const nextId = rows[nextIndex]?.id;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-white/[0.05]">
        <span className="size-6 rounded-md grid place-items-center bg-accent-500/15 text-accent-600 dark:text-accent-400 shrink-0">
          <CalendarDays size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold">Agenda de hoje</h3>
          <p className="text-[11px] text-muted-foreground truncate">
            Visitas e aulas da academia · não conta na sua meta
          </p>
        </div>
        {pending > 0 && (
          <span className="num text-[11px] px-1.5 h-[18px] rounded-md grid place-items-center bg-accent-500/15 text-accent-600 dark:text-accent-400 shrink-0">
            {pending}
          </span>
        )}
      </div>

      <div className="px-2.5 pt-2.5">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v)}
          className="w-full gap-1"
        >
          <ToggleGroupItem value="pending" className="flex-1 h-7 text-[11.5px]">
            Pendentes
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="flex-1 h-7 text-[11.5px]">
            Todos
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="p-2.5 max-h-[280px] overflow-y-auto thin-scroll">
        {visible.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-muted-foreground">
            Tudo com presença registrada.
          </div>
        ) : (
          visible.map((row) => {
            const isNext = row.id === nextId;
            const Icon = row.categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE ? Building2 : BookOpen;
            return (
              <div key={row.id} className="flex gap-2">
                {/* Trilho: hora + bolinha de estado. A hora mora AQUI para a
                    linha de conteúdo ficar com a largura toda. */}
                <div className="w-[44px] shrink-0 flex flex-col items-center pt-1.5">
                  <span
                    className={cn(
                      'num text-[11px] leading-none',
                      isNext ? 'text-accent-600 dark:text-accent-400 font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {hourLabel(row.scheduledAt)}
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 size-[7px] rounded-full shrink-0',
                      row.outcome ? 'bg-emerald-500' : isNext ? 'bg-accent-500' : 'bg-slate-300 dark:bg-neutral-600'
                    )}
                  />
                  <span className="flex-1 w-px bg-slate-100 dark:bg-white/[0.06] min-h-[10px]" />
                </div>

                <div
                  className={cn(
                    'flex-1 min-w-0 mb-1.5 flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-white/[0.03] border',
                    isNext ? 'border-accent-400 dark:border-accent-500/40' : 'border-slate-200/70 dark:border-white/[0.06]',
                    row.isMine && 'border-l-2 border-l-accent-500 rounded-l-none'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {row.name}
                      {row.isClient && (
                        <span className="text-[9.5px] font-normal px-1 rounded bg-slate-100 dark:bg-white/[0.08] text-muted-foreground shrink-0">
                          cliente
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground truncate flex items-center gap-1">
                      <Icon size={11} className="shrink-0" />
                      {subtitleOf(row)}
                    </div>
                  </div>
                  <PresenceSwitch
                    attKey={row.outcome}
                    saving={savingId === row.id}
                    onMark={(o) => onMark(row, o)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
