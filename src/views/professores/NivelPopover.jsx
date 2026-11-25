import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { fromDateInputValue, toDateInputValue } from '../../lib/dates.js';
import { NIVEIS, nivelTexto } from '../../lib/professor/metas.js';

// "Trocar nível" do perfil, só do gestor: os três níveis num grupo de rádio e
// a data em que o nível passa a valer (padrão hoje). Quem grava é a tela
// (onSalvar({ nivel, desde }) devolve true quando gravou). O nível é o de
// agora: a troca não reescreve nada do passado.
const PILULA = 'h-8 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors';
const LINK = 'rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300';

export function NivelPopover({ nivel, onSalvar }) {
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState('');
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Cada abertura começa do nível de agora e da data de hoje.
  const abrir = (sim) => {
    if (sim) {
      setEscolha(NIVEIS.includes(nivel) ? nivel : '');
      setData(toDateInputValue(new Date()));
    }
    if (!salvando) setAberto(sim);
  };

  const desde = fromDateInputValue(data);
  const falta = !NIVEIS.includes(escolha) ? 'Escolha o nível.' : !desde ? 'Escolha a data.' : null;

  const salvar = async (e) => {
    e.preventDefault();
    if (falta || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ nivel: escolha, desde });
    setSalvando(false);
    if (ok) setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger className={LINK}>{NIVEIS.includes(nivel) ? 'Trocar nível' : 'Definir nível'}</PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-4">
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div>
            <p id="nivel-escolha" className="mb-2 text-[13px] font-semibold">Nível</p>
            <RadioGroup aria-labelledby="nivel-escolha" value={escolha} onValueChange={setEscolha} className="flex flex-wrap gap-2">
              {NIVEIS.map((n) => (
                <RadioGroupOption
                  key={n}
                  value={n}
                  className={cn(
                    PILULA,
                    n === escolha
                      ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {nivelTexto(n)}
                </RadioGroupOption>
              ))}
            </RadioGroup>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Desde
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] font-normal outline-none focus-visible:anel-foco"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p role="status" className="text-[12.5px] text-muted-foreground">{falta}</p>
            <button
              type="submit"
              disabled={Boolean(falta) || salvando}
              className="h-9 flex-none rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white outline-none hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar nível'}
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
