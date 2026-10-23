import { useId } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Select, SelectContent, SelectItem } from '../ui/select.jsx';

// O Radix não aceita item com value vazio, então "sem professor" e "sem dor"
// usam um valor de mentira, que sai como null para quem escuta.
const NONE = '__nenhum__';

// Letra com a lista fechada: o Radix escolheria na hora o item que começa com
// ela, e a escolha grava (um "B" no Consultor passaria o lead para o Bruno). A
// lista só abre pelas teclas de abrir (Enter, Espaço e setas).
const blockTypeahead = (e) => {
  if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
};

// Um campo de escolha do Contexto comercial. A própria célula é o gatilho da
// lista (o Trigger do Radix), então nada troca de lugar ao abrir, e o foco volta
// para ela pelo próprio Radix ao escolher ou ao fechar. O nome lido é "Editar",
// o rótulo e o valor (aria-labelledby, porque combobox não tira o nome do
// conteúdo). `onPick` recebe o valor escolhido, ou null na opção vazia.
export function ContextSelect({ label, labelClassName, display, valueClassName, emptyText, value, options, emptyLabel = null, onPick, className, children }) {
  const id = useId();
  return (
    <Select value={value || ''} onValueChange={(v) => onPick(v === NONE ? null : v)}>
      <SelectPrimitive.Trigger aria-labelledby={`${id}e ${id}l ${id}v`} onKeyDown={blockTypeahead} className={className}>
        <span id={`${id}e`} className="sr-only">Editar </span>
        <span id={`${id}l`} className={labelClassName}>{label}</span>
        {/* O Value do Radix descarta o className, então o estilo fica num span por fora. */}
        <span id={`${id}v`} className={valueClassName}>
          <SelectPrimitive.Value placeholder={emptyText}>{display}</SelectPrimitive.Value>
        </span>
        {children}
      </SelectPrimitive.Trigger>
      <SelectContent className="border-border">
        {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
