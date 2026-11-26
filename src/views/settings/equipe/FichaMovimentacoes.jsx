import { dataBR, tipoDesligamentoTexto, vinculoTexto } from '../../../lib/equipe/ficha.js';

const TITULO = { admissao: 'Admissão', desligamento: 'Desligamento', readmissao: 'Readmissão' };
const PONTO = { admissao: 'bg-emerald-500', desligamento: 'bg-rose-500', readmissao: 'bg-brand-600' };

// A linha do tempo das movimentações, da mais nova para a mais antiga.
// Ninguém apaga uma entrada. `acoes` recebe os botões Desligar e Readmitir no PR 3.
export function FichaMovimentacoes({ pessoa, acoes = null }) {
  const movs = [...(pessoa.ficha?.movimentacoes || [])].reverse();
  return (
    <section aria-label="Movimentações" className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <header className="flex items-center gap-3"><h3 className="flex-1 font-display text-[15px] font-bold">Movimentações</h3>{acoes}</header>
      {movs.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">Sem movimentação ainda. A admissão entra quando você preenche a data em Dados, no bloco Trabalho.</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {movs.map((m, i) => (
            <li key={`${m.tipo}-${m.data}-${i}`} className="grid grid-cols-[88px_18px_1fr] gap-3 pb-4 last:pb-0">
              <span className="pt-0.5 text-right text-[12.5px] tabular-nums text-muted-foreground">{dataBR(m.data)}</span>
              <span aria-hidden="true" className={`mt-1 size-3.5 rounded-full border-[3px] border-card ring-1 ring-border ${PONTO[m.tipo] || 'bg-slate-400'}`} />
              <div>
                <p className="text-[14px] font-semibold">{TITULO[m.tipo] || 'Movimentação'}</p>
                <p className="text-[13px] text-muted-foreground">
                  {m.tipo === 'desligamento'
                    ? [tipoDesligamentoTexto(m.tipoDesligamento), m.motivo].filter(Boolean).join('. ')
                    : `Vínculo ${vinculoTexto(m.vinculo)}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[12px] text-muted-foreground">Ninguém apaga uma movimentação. O tipo e o motivo do desligamento só o gestor vê.</p>
    </section>
  );
}
