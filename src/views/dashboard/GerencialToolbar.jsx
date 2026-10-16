// Barra fixa do Gerencial: o período com setas e o chip "Comparar com", na
// barra única dos dashboards (DashToolbar). O aviso de que o número é contrato
// vendido e não caixa recebido mora no herói. Não tem filtro de unidade: o
// contrato não guarda unidade.
import { DashToolbar } from './DashFilterBar.jsx';

export function GerencialToolbar({
  title, subline, monthKey, monthOptions, onMonth, canPrev, onPrev, canNext, onNext,
  compareOn, compareKey, compareOptions, onCompare
}) {
  return (
    <DashToolbar
      title={title}
      subline={subline}
      month={{ key: monthKey, options: monthOptions, onChange: onMonth, canPrev, canNext, onPrev, onNext }}
      compare={{ on: compareOn, key: compareKey, options: compareOptions, onChange: onCompare }}
    />
  );
}
