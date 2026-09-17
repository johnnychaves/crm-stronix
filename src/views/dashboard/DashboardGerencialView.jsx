// Tela Gerencial (Visão geral · Gerencial): o dinheiro vendido no mês, o que a
// carteira vale por mês, o que está para sair e quem vende. Visual e textos:
// handoff do Claude Design (docs/superpowers/specs/handoff-gerencial/). A
// matemática vem de src/lib/gerencial/ (metricsOf) e o mapeamento para as props
// da tela vem de lib/gerencial/viewModel.js; aqui é só estado e carga, no molde
// do DashboardCrmView.
//
// A tela quase não custa leitura: os contratos e os planos já chegam assinados
// pelo useGeneralConfig. A única consulta é a dos leads das vendas do mês, e
// ela serve só à origem (useGerencialLeads).
import { useEffect, useMemo, useState } from 'react';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useGerencialLeads } from '../../hooks/useGerencialLeads.js';
import { normalizeContracts } from '../../lib/operacional/base.js';
import { monthKeyOf, addMonthsToKey, monthLabel, comparisonCut } from '../../lib/operacional/month.js';
import { metricsOf } from '../../lib/gerencial/metrics.js';
import { saleMoment } from '../../lib/gerencial/scope.js';
import { monthSubline } from '../../lib/gerencial/texts.js';
import { dashboardProps } from '../../lib/gerencial/viewModel.js';
import { GerencialToolbar } from './GerencialToolbar.jsx';
import { GerencialDashboard } from './GerencialDashboard.jsx';

const roleOf = (user) => (user?.role === 'admin' ? 'Gestor · também vende' : 'Consultor');

export function DashboardGerencialView({ usersList, liveLeads, db, listenersActive = true, onNavigate }) {
  const { contratos } = useGeneralConfig();

  // Relógio da tela: vira o minuto. A carteira e o risco são retrato de agora,
  // então dependem dele tanto quanto o mês em andamento.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = o mês anterior com venda

  // A lista inteira de uma vez: a pausa do contrato trancado que ganhou
  // sucessor só fecha olhando os outros contratos da pessoa (base.js).
  const contracts = useMemo(() => normalizeContracts(contratos), [contratos]);

  // Meses que tiveram venda. O handoff pede que mês sem venda não apareça na
  // lista de comparação: comparar com um mês que não existia é ruído.
  const saleMonths = useMemo(() => {
    const set = new Set();
    contracts.forEach((c) => {
      if (c.imported) return;
      const t = saleMoment(c);
      if (t) set.add(monthKeyOf(t));
    });
    return set;
  }, [contracts]);

  const earlierWithSales = useMemo(
    () => [...saleMonths].filter((k) => k < monthKey).sort().reverse(),
    [saleMonths, monthKey]
  );
  const canCompare = earlierWithSales.length > 0;
  const cmpKey = canCompare
    ? (compareKey && earlierWithSales.includes(compareKey) ? compareKey : earlierWithSales[0])
    : null;
  const comparing = compareOn && Boolean(cmpKey);

  const monthKeys = useMemo(
    () => [...new Set([monthKey, ...(comparing ? [cmpKey] : [])])],
    [monthKey, comparing, cmpKey]
  );
  const leadsById = useGerencialLeads({ db, enabled: listenersActive, contracts, monthKeys, liveLeads });

  const ctx = useMemo(() => ({ now, contracts, leadsById }), [now, contracts, leadsById]);
  const cur = useMemo(() => metricsOf(ctx, { monthKey }), [ctx, monthKey]);
  const cmp = useMemo(
    // Corte pró-rata só com o mês exibido em andamento; mês fechado compara inteiro.
    () => (comparing
      ? metricsOf(ctx, { monthKey: cmpKey, cutEnd: monthKey === currentKey ? comparisonCut(monthKey, cmpKey, now) : null })
      : null),
    [comparing, ctx, cmpKey, monthKey, currentKey, now]
  );

  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const props = useMemo(
    () => dashboardProps({ cur, cmp, comparing, roleOf: (id) => roleOf(userById.get(id)) }),
    [cur, cmp, comparing, userById]
  );

  const oldestKey = addMonthsToKey(currentKey, -11);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );
  const cmpOptions = earlierWithSales.map((k) => ({ key: k, label: monthLabel(k) }));
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };

  const subline = monthSubline({
    running: cur.running, elapsed: now.getDate(), monthKey, compareOn: comparing, cmpKey
  });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="-m-4 md:-m-8 font-sans">
        <header className="bg-card px-4 md:px-8 pb-4 pt-5">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">Gerencial</h2>
          <p className="mt-[5px] max-w-[860px] text-[12.5px] leading-normal text-muted-foreground">{subline}</p>
        </header>
        <GerencialToolbar
          monthKey={monthKey} monthOptions={monthOptions} onMonth={changeMonth}
          canPrev={monthKey > oldestKey} onPrev={() => { if (monthKey > oldestKey) changeMonth(addMonthsToKey(monthKey, -1)); }}
          canNext={monthKey < currentKey} onNext={() => { if (monthKey < currentKey) changeMonth(addMonthsToKey(monthKey, 1)); }}
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey || ''} compareOptions={cmpOptions} onCompare={setCompareKey}
          canCompare={canCompare}
        />
        <GerencialDashboard {...props} onGoToPipeline={() => onNavigate?.('kanban')} />
      </div>
    </TooltipProvider>
  );
}
