// O "Ver a Meta de" do gestor: escolhe de quem a Meta diária aparece. Os
// consultores valem em toda academia (só para olhar) e os professores, só com
// o Stronix 2.0. O valor é "c:<id>" ou "p:<id>", e vazio é a Meta do gestor.
export function SeletorDeMeta({ professores = [], consultores = [], valor, onEscolher }) {
  const grupos = consultores.length > 0 && professores.length > 0;
  const opcoes = (lista, tipo) => lista.map((p) => <option key={`${tipo}:${p.id}`} value={`${tipo}:${p.id}`}>{p.nome}</option>);
  const escolher = (v) => {
    if (!v) return onEscolher(null);
    const [tipo, ...resto] = v.split(':');
    return onEscolher({ tipo: tipo === 'c' ? 'consultor' : 'professor', id: resto.join(':') });
  };
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      Ver a Meta de
      <select
        value={valor || ''}
        onChange={(e) => escolher(e.target.value)}
        className="h-9 rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-semibold text-brand-700 focus-visible:outline-none focus-visible:anel-foco dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
      >
        <option value="">Minha meta</option>
        {grupos ? (
          <>
            <optgroup label="Consultores">{opcoes(consultores, 'c')}</optgroup>
            <optgroup label="Professores">{opcoes(professores, 'p')}</optgroup>
          </>
        ) : (
          <>{opcoes(consultores, 'c')}{opcoes(professores, 'p')}</>
        )}
      </select>
    </label>
  );
}
