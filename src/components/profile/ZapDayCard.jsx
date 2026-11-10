// O cartão do dia do Stronizap na linha do tempo da ficha (Parte B, PR 3,
// desenho B): as linhas de sinal de um dia ("Lead escreveu", "Resposta de Ana
// Souza", "Resposta da IA") num bloco só, da mais nova para a mais antiga. Os
// textos saem de zapDayRows, em lib/timeline.js. Quem junta as linhas é o
// groupZapSignalDays, e o TimelineEvent põe o cartão na régua.
import { StronizapBadge } from '../brand/StronizapMark.jsx';
import { zapDayRows } from '../../lib/timeline.js';

export function ZapDayCard({ rows }) {
  const linhas = zapDayRows(rows);
  return (
    <div className="mt-1 max-w-[560px] rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="flex flex-wrap items-center gap-2 pb-1 text-[13.5px] font-semibold">
        <StronizapBadge />
        Conversa no Stronizap
      </p>
      <ul>
        {linhas.map((l) => (
          <li key={l.id} className="flex min-w-0 items-baseline gap-2.5 border-t border-border py-1 text-[13.5px]">
            <span className="num w-10 shrink-0 text-[12.5px] font-semibold text-muted-foreground">{l.time}</span>
            <span className="min-w-0 break-words"><b className="font-semibold">{l.label}</b>{l.extra ? ` · ${l.extra}` : ''}</span>
          </li>
        ))}
      </ul>
      {/* shortcut: sem o "Ver no Stronizap" até existir a rota que abre a conversa a partir do lead (projeto Conversar); quando existir, o link entra aqui, no rodapé do cartão. */}
    </div>
  );
}
