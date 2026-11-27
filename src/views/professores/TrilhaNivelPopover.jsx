import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { fromDateInputValue, toDateInputValue } from '../../lib/dates.js';

// "Trilha e nível" do perfil, só do gestor (spec 2026-11-26, "Menu
// Carreira"): a trilha (a sugerida marcada), o nível dela e a data em que
// passa a valer (padrão hoje). Trocar a trilha pede o nível de novo. Quem
// grava é a tela: onSalvar({ trilhaId, nivel, desde }) devolve true quando
// gravou. A troca vale da data em diante e não reescreve o passado.
const PILULA = 'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors';
const ESCOLHIDA = 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300';
const LIVRE = 'border-border bg-card text-muted-foreground hover:text-foreground';
const LINK = 'rounded text-[13px] font-semibold text-brand-700 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300';

// `rotulo` troca o texto do botão (a aba Pessoas das Configurações usa "Mudar
// nível" e "Pôr na trilha"); sem ele, vale o de sempre.
export function TrilhaNivelPopover({ trilhas, trilhaId, nivel, sugeridaId, onSalvar, rotulo = null }) {
  const [aberto, setAberto] = useState(false);
  const [trilha, setTrilha] = useState('');
  const [escolha, setEscolha] = useState('');
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);

  const atual = (trilhas || []).find((t) => t.id === trilhaId) ?? null;
  const temNivel = Boolean(atual?.niveis.some((n) => n.id === nivel));

  // Cada abertura começa da trilha e do nível de agora e da data de hoje.
  const abrir = (sim) => {
    if (sim) {
      setTrilha(atual ? atual.id : sugeridaId ?? '');
      setEscolha(temNivel ? nivel : '');
      setData(toDateInputValue(new Date()));
    }
    if (!salvando) setAberto(sim);
  };

  const escolhida = (trilhas || []).find((t) => t.id === trilha) ?? null;
  const trocarTrilha = (id) => {
    if (id === trilha) return;
    setTrilha(id);
    setEscolha('');
  };

  const desde = fromDateInputValue(data);
  const falta = !escolhida ? 'Escolha a trilha.'
    : !escolhida.niveis.some((n) => n.id === escolha) ? 'Escolha o nível.'
      : !desde ? 'Escolha a data.' : null;

  const salvar = async (e) => {
    e.preventDefault();
    if (falta || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ trilhaId: escolhida.id, nivel: escolha, desde });
    setSalvando(false);
    if (ok) setAberto(false);
  };

  // A trilha arquivada só aparece para quem já está nela.
  const opcoes = (trilhas || []).filter((t) => !t.arquivada || t.id === trilhaId);

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger className={LINK}>{rotulo ?? (atual && temNivel ? 'Trilha e nível' : 'Definir trilha e nível')}</PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-4">
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div>
            <p id="carreira-trilha" className="mb-2 text-[13px] font-semibold">Trilha</p>
            <RadioGroup aria-labelledby="carreira-trilha" value={trilha} onValueChange={trocarTrilha} className="flex flex-wrap gap-2">
              {opcoes.map((t) => (
                <RadioGroupOption key={t.id} value={t.id} className={cn(PILULA, t.id === trilha ? ESCOLHIDA : LIVRE)}>
                  {t.nome}
                  {t.id === sugeridaId && <span className="rounded-full bg-accent-50 px-1.5 text-[11px] font-semibold text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">sugerida</span>}
                </RadioGroupOption>
              ))}
            </RadioGroup>
          </div>
          {escolhida && (
            <div>
              <p id="carreira-nivel" className="mb-2 text-[13px] font-semibold">Nível</p>
              <RadioGroup aria-labelledby="carreira-nivel" value={escolha} onValueChange={setEscolha} className="flex flex-wrap gap-2">
                {escolhida.niveis.map((n) => (
                  <RadioGroupOption key={n.id} value={n.id} className={cn(PILULA, n.id === escolha ? ESCOLHIDA : LIVRE)}>
                    {n.nome}
                  </RadioGroupOption>
                ))}
              </RadioGroup>
            </div>
          )}
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
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
