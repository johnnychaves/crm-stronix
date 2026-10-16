// A faixa de quatro números do CRM (mockup A), logo abaixo do herói: leads
// novos, agendamentos, comparecimento e matrículas do mês, sem caixa. A
// conversão da safra mora no herói. Cada número traz a variação contra o mês
// comparado e a linha de apoio que a faixa de resumo já calculava.
//
// Embaixo, a frase que desfaz a dúvida mais comum da tela (safraNote, em
// lib/crm/texts.js): por que 29 matrículas convivem com 18% de conversão.
//
// Props:
//   items  os itens de summaryItems (src/lib/crm/texts.js), sem o da conversão
//   note   { enroll, fromCohort, conv, monthName } ou null
import { cn } from '../../lib/utils.js';
import { DashHelpTip } from './DashPrimitives.jsx';
import { ItemDelta } from './ItemDelta.jsx';

// Variação do CRM ({ up, flat, none, text }) no formato do ItemDelta.
function toneOf(d, goodUp) {
  if (!d) return null;
  if (d.none) return { tone: 'quiet', text: d.text };
  if (d.flat) return { tone: 'quiet', text: 'igual' };
  return { up: d.up, tone: d.up === goodUp ? 'good' : 'bad', text: String(d.text).replace(/^[+−-]\s?/, '') };
}

export function CrmTape({ items, note }) {
  const list = items || [];
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-0">
        {list.map((k) => {
          const d = toneOf(k.delta, k.goodUp);
          return (
            <div key={k.key} className="min-w-0 px-1 py-1 md:border-l md:border-border md:px-6 md:first:border-l-0 md:first:pl-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-muted-foreground">{k.label}</span>
                {k.help && <DashHelpTip text={k.help} label={`O que é "${k.label}"?`} />}
                {k.flag && <span className="rounded-[5px] bg-amber-500/[0.12] px-[5px] py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{k.flag}</span>}
              </div>
              <div className="num mt-1.5 whitespace-nowrap font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">{k.value}</div>
              <div className={cn('mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground')}>
                <ItemDelta delta={d} />
                <span className="num">{k.sub}</span>
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <p className="mt-5 text-pretty rounded-[14px] bg-brand-50 px-[18px] py-3.5 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{note}</p>
      )}
    </div>
  );
}
