// Carteira agora (handoff do CRM, linhas 588 a 629; celular, 698 a 704): os
// leads em jogo neste instante, por funil (em Todos os funis) ou por etapa, e
// o card vermelho dos que estão em jogo sem próximo contato marcado. Esses não
// aparecem na Meta Diária de ninguém. Só no mês em andamento; no mês fechado
// a tela mostra o cartão tracejado no lugar.
import { TriangleAlert } from 'lucide-react';
import { fmtNum } from '../../lib/format.js';
import { plural } from '../../lib/crm/format.js';
import { ChartMark } from './ChartMark.jsx';
import { CrmCard, DashedNote, ReadText } from './CrmParts.jsx';

export function PipelineNowCard({ now, funnelName, personName }) {
  const byFunnel = !funnelName;
  const rows = now?.rows || [];
  const total = now?.total || 0;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const hint = `${plural(total, 'lead aberto agora', 'leads abertos agora')}${personName ? ` na carteira de ${personName}` : ''}`;
  const tipOf = (r) => {
    const what = plural(r.count, 'lead em jogo agora', 'leads em jogo agora');
    if (!byFunnel) return `Etapa ${r.name}: ${what}`;
    return r.id ? `Funil ${r.name}: ${what}` : `${r.name}: ${what}`;
  };
  const read = byFunnel
    ? 'Etapa de funis diferentes não soma, então em Todos os funis a carteira aparece por funil. Escolha um funil na barra de cima para ver a fila por etapa.'
    : `Leads abertos no funil ${funnelName} agora, de qualquer safra. Não é o mês: é a fila que existe neste instante.`;
  return (
    <CrmCard title={byFunnel ? 'Em jogo por funil' : 'Em jogo por etapa'} hint={hint}>
      <div className="flex flex-col gap-2.5 px-[18px] pb-4 pt-3.5">
        {total === 0 ? (
          <DashedNote title="Nenhum lead em jogo agora." />
        ) : rows.map((r) => (
          <div key={r.id ?? r.name} className="grid grid-cols-[132px_minmax(0,1fr)_34px] items-center gap-3">
            <span className="truncate text-[12.5px] font-medium">{r.name}</span>
            <ChartMark
              tip={tipOf(r)}
              className="block h-5 min-w-[3px] rounded-[5px] bg-brand-600/90"
              style={{ width: `${Math.round((r.count / max) * 100)}%` }}
            />
            <span className="num text-right text-[13px] font-bold">{fmtNum(r.count)}</span>
          </div>
        ))}
        <ReadText className="mt-1">{read}</ReadText>
      </div>
    </CrmCard>
  );
}

export function NoNextContactCard({ count, total }) {
  return (
    <section className="flex flex-col rounded-2xl border border-danger bg-rose-50 p-[18px] shadow-card dark:border-[#E11D48] dark:bg-rose-500/10">
      <div className="flex items-center gap-[9px]">
        <span className="grid size-[26px] flex-none place-items-center rounded-lg bg-danger text-white dark:bg-[#E11D48]">
          <TriangleAlert size={14} strokeWidth={2.4} />
        </span>
        <h4 className="m-0 text-[14px] font-semibold">Sem próximo contato</h4>
      </div>
      <div className="num mt-3.5 font-display text-[44px] font-bold leading-none tracking-[-0.02em] text-rose-700 dark:text-rose-300">{fmtNum(count)}</div>
      <div className="num mt-1 text-[12px] text-rose-700 dark:text-rose-300">{`de ${fmtNum(total)} em jogo`}</div>
      <p className="mt-3.5 text-pretty text-[12px] leading-[1.55] text-foreground/80">
        Leads em jogo sem data de próximo contato marcada. Eles não aparecem na Meta Diária de ninguém, então ficam parados até alguém marcar o próximo contato.
      </p>
    </section>
  );
}
