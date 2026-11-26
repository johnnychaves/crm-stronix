import { DialogField, FIELD_INPUT } from '../settingsBits.jsx';

// Escolha do professor do cadastro que a pessoa é: só os ativos e sem login,
// mais o próprio professor de quem está sendo editado.
export function ProfessorPicker({ value, options, onChange, disabled = false }) {
  return (
    <DialogField
      label="Professor do cadastro"
      hint={options.length === 0
        ? 'Nenhum professor ativo sem acesso. Cadastre o professor no card Professores, mais abaixo.'
        : 'Cada professor do cadastro tem um login só.'}
    >
      <select className={FIELD_INPUT} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} required>
        <option value="" disabled>Escolha o professor</option>
        {options.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </DialogField>
  );
}
