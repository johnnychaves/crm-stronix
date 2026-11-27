// O "Ver a Meta de" do gestor: escolhe qual professor a Meta diária mostra.
export function SeletorDeMeta({ professores, valor, onEscolher }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      Ver a Meta de
      <select
        value={valor || ''}
        onChange={(e) => onEscolher(e.target.value || null)}
        className="h-9 rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-semibold text-brand-700 focus-visible:outline-none focus-visible:anel-foco dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
      >
        <option value="">Minha meta</option>
        {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </label>
  );
}
