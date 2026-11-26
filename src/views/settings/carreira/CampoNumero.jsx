import { useState } from 'react';
import { cn } from '@/lib/utils';
import { lerNumero, numeroParaTexto } from './carreiraTexto.js';

// O campo das metas e do tempo mínimo (mockup A): a unidade mora dentro dele
// ("45 % ou mais", "R$ 12 mil"), e o campo em branco fica tracejado com "sem
// meta". O texto digitado fica aqui, e o rascunho recebe o número: null quando
// vazio, NaN quando não é número. `escala` mostra o valor dividido (vendas em
// mil reais) e devolve multiplicado. Quando o valor muda por fora (Descartar),
// o texto acompanha, sem perder o "9," do meio da digitação.
export function CampoNumero({ valor, onValor, antes, depois, escala = 1, rotulo, vazio = 'sem meta', className }) {
  const mostrado = valor == null || Number.isNaN(valor) ? valor : valor / escala;
  const [texto, setTexto] = useState(() => numeroParaTexto(mostrado));
  const [visto, setVisto] = useState(mostrado);
  if (!Object.is(visto, mostrado)) {
    setVisto(mostrado);
    if (!Object.is(lerNumero(texto), mostrado)) setTexto(numeroParaTexto(mostrado));
  }
  const emBranco = texto.trim() === '';
  const invalido = Number.isNaN(lerNumero(texto));

  function mudar(e) {
    const n = lerNumero(e.target.value);
    setTexto(e.target.value);
    onValor(n == null || Number.isNaN(n) ? n : Math.round(n * escala * 100) / 100);
  }

  return (
    <label
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-[11px] border bg-card px-[11px] transition-colors focus-within:border-brand-600 focus-within:anel-foco motion-reduce:transition-none',
        emBranco ? 'border-dashed border-border bg-muted/30' : 'border-border',
        invalido && 'border-rose-500',
        className,
      )}
    >
      {antes && <em className="text-[12.5px] font-medium not-italic text-foreground/80">{antes}</em>}
      <input
        inputMode="decimal"
        value={texto}
        placeholder={vazio}
        aria-label={rotulo}
        aria-invalid={invalido || undefined}
        onChange={mudar}
        className={cn(
          'border-0 bg-transparent p-0 text-right text-[15px] font-semibold tabular-nums outline-none placeholder:text-[13px] placeholder:font-medium placeholder:text-muted-foreground/70',
          emBranco && vazio ? 'w-[62px]' : 'w-12',
        )}
      />
      {depois && <em className="whitespace-nowrap text-[12.5px] not-italic text-muted-foreground">{depois}</em>}
    </label>
  );
}
