import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.jsx';

// O Radix não aceita item com value vazio, então "sem professor" e "sem dor"
// usam um valor de mentira, que sai como null para quem escuta.
const NONE = '__nenhum__';

// A lista de escolha de um campo do Contexto comercial. Abre aberta, porque quem
// a monta acabou de clicar no campo. `onPick` recebe o valor escolhido (ou null,
// na opção vazia) e `onCancel` roda quando a lista fecha. O Radix fecha a lista
// também depois de uma escolha, então quem escuta o onCancel precisa aceitar que
// ele venha depois do onPick.
export function ContextSelect({ label, value, options, emptyLabel = null, onPick, onCancel }) {
  return (
    <Select
      defaultOpen
      value={value || (emptyLabel ? NONE : '')}
      onValueChange={(v) => onPick(v === NONE ? null : v)}
      onOpenChange={(open) => { if (!open) onCancel(); }}
    >
      <SelectTrigger aria-label={label} className="h-9 w-full justify-between rounded-lg border-border bg-card text-[14px] font-semibold focus-visible:anel-foco">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border">
        {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
