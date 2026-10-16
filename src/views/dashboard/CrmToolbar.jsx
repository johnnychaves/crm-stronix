// Cabeçalho fixo do CRM: título e linha do regime, mês, comparativo, pessoa e
// funil, na barra única dos dashboards (DashToolbar), igual à do Gerencial e à
// do Operacional.
import { Filter, User } from 'lucide-react';
import { DashToolbar } from './DashFilterBar.jsx';

export function CrmToolbar({
  title, subline, monthKey, monthOptions, onMonth, canPrev, onPrev, canNext, onNext,
  compareOn, compareKey, compareOptions, onCompare,
  person, people, onPerson, funnel, funnels, onFunnel
}) {
  return (
    <DashToolbar
      title={title}
      subline={subline}
      month={{ key: monthKey, options: monthOptions, onChange: onMonth, canPrev, canNext, onPrev, onNext }}
      compare={{ on: compareOn, key: compareKey, options: compareOptions, onChange: onCompare }}
      filters={[
        {
          id: 'person', icon: User, label: 'Pessoa', value: person, defaultValue: 'all', onChange: onPerson,
          options: [{ key: 'all', label: 'Equipe toda' }, ...(people || []).map((p) => ({ key: p.id, label: p.name }))]
        },
        {
          id: 'funnel', icon: Filter, label: 'Funil', value: funnel, defaultValue: 'all', onChange: onFunnel,
          options: [{ key: 'all', label: 'Todos os funis' }, ...(funnels || []).map((f) => ({ key: f.id, label: f.name }))]
        }
      ]}
    />
  );
}
