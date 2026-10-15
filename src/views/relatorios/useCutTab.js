// A aba aberta dos recortes (CutTabs). Ela não é filtro: fica na tela e não vai
// para o endereço. Quem manda nela é o recorte da lista, quando ele muda: o link
// com consultor:<id> abre em Por consultor, e a linha clicada fica na aba dela.
// Recorte de um número do painel (situacao:...), ou recorte limpo, deixa a aba
// onde está. Com o recorte aceso, trocar de aba só troca a aba. Ajuste de estado
// no render, guardado por condição, como o "Mostrar mais" da ReportList.
import { useState } from 'react';

const tabOfCut = (tabs, cut) => (cut ? tabs.find((t) => t.rows.some((r) => r.key === cut))?.value : undefined);

export function useCutTab(tabs, cut) {
  const [pick, setPick] = useState(() => ({ cut, tab: tabOfCut(tabs, cut) ?? tabs[0]?.value }));
  let tab = pick.tab;
  if (pick.cut !== cut) {
    tab = tabOfCut(tabs, cut) ?? pick.tab;
    setPick({ cut, tab });
  }
  return [tab, (value) => setPick({ cut, tab: value })];
}
