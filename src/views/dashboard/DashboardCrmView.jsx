// Tela CRM (Visão geral · CRM): o funil de leads por mês de competência, do
// cadastro até a matrícula, igual para todos os perfis, com comparativo,
// filtro de pessoa e filtro de funil. Visual e textos: handoff do Claude
// Design (docs/superpowers/specs/handoff-crm/). A matemática vem de
// src/lib/crm/ (metricsOf); aqui é só estado, carga e orquestração, no molde
// do DashboardOperacionalView.

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { useCrmSources } from '../../hooks/useCrmSources.js';
import { monthKeyOf, addMonthsToKey, comparisonCut, compareOptions, monthLabel } from '../../lib/operacional/month.js';
import { metricsOf, buildCrmHighlights, seriesOf, OTHERS_ID } from '../../lib/crm/metrics.js';
import { crmMonthKeys } from '../../lib/crm/queries.js';
import { leadFunnelsOf, APPTS_COMPLETE_MONTH } from '../../lib/crm/scope.js';
import { monthName } from '../../lib/crm/format.js';
import { regimeTexts } from '../../lib/crm/texts.js';
import { cn } from '../../lib/utils.js';
import { CrmToolbar } from './CrmToolbar.jsx';
import { CrmDashboard } from './CrmDashboard.jsx';

// Aviso sob a barra, quando algum mês não carregou (mesmo do Operacional).
function Notice({ children }) {
  return (
    <p role="status" className="flex items-center gap-1.5 px-4 md:px-8 pt-3 text-[12px] text-amber-700 dark:text-amber-300">
      <CircleAlert size={13} strokeWidth={2.2} className="flex-none" />
      {children}
    </p>
  );
}

export function DashboardCrmView({ usersList, liveLeads, interactions, db, listenersActive = true, funnels, statuses }) {
  // Relógio da tela: vira o minuto (mês em andamento, pró-rata, carteira de agora).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentKey = monthKeyOf(now);
  const [monthKey, setMonthKey] = useState(currentKey);
  const [compareOn, setCompareOn] = useState(true);
  const [compareKey, setCompareKey] = useState(null); // null = mês anterior
  const [person, setPerson] = useState('all');
  const [funnel, setFunnel] = useState('all');

  const users = useMemo(() => (usersList || []).filter((u) => u?.id), [usersList]);
  const leadFunnels = useMemo(() => leadFunnelsOf(funnels), [funnels]);
  // Pessoa ou funil que saiu da lista (usuário removido, funil apagado) vale "todos".
  const userId = person !== 'all' && users.some((u) => u.id === person) ? person : null;
  const funnelId = funnel !== 'all' && leadFunnels.some((f) => f.id === funnel) ? funnel : null;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
  // A lista de meses vai até 11 meses atrás; a seta não passa dela.
  const oldestKey = addMonthsToKey(currentKey, -11);

  const monthKeys = useMemo(
    () => crmMonthKeys({ monthKey, compareOn, compareKey: cmpKey, currentKey }),
    [monthKey, compareOn, cmpKey, currentKey]
  );
  const sources = useCrmSources({ db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads });

  const ctx = useMemo(() => ({
    now, users, funnels: funnels || [], statuses: statuses || [], liveLeads,
    leadsById: sources.leadsById,
    months: sources.months
  }), [now, users, funnels, statuses, liveLeads, sources.leadsById, sources.months]);

  const curLoaded = useMemo(() => metricsOf(ctx, { monthKey, userId, funnelId }), [ctx, monthKey, userId, funnelId]);
  const cmpLoaded = useMemo(
    // Corte pró-rata só com o mês exibido em andamento. Mês fechado compara
    // inteiro, e as duas safras são acompanhadas até agora.
    () => (compareOn ? metricsOf(ctx, { monthKey: cmpKey, userId, funnelId, cutEnd: monthKey === currentKey ? comparisonCut(monthKey, cmpKey, now) : null }) : null),
    [compareOn, ctx, cmpKey, userId, funnelId, monthKey, currentKey, now]
  );
  const seriesLoaded = useMemo(() => {
    const s = (pick, apptsBased = false) => seriesOf(ctx, { monthKey, userId, funnelId, pick, apptsBased });
    return {
      leads: s((m) => m.leads),
      appts: s((m) => m.appts?.total ?? null, true),
      attend: s((m) => m.appts?.rate ?? null, true),
      enroll: s((m) => m.enroll),
      conv: s((m) => m.cohort?.conv ?? null)
    };
  }, [ctx, monthKey, userId, funnelId]);
  // Uma linha por pessoa (só a escolhida, com filtro) e a de quem está fora da equipe.
  const teamLoaded = useMemo(() => ({
    rows: (userId ? users.filter((u) => u.id === userId) : users)
      .map((u) => ({ user: u, m: metricsOf(ctx, { monthKey, userId: u.id, funnelId }) })),
    others: userId ? null : metricsOf(ctx, { monthKey, userId: OTHERS_ID, funnelId })
  }), [ctx, monthKey, userId, funnelId, users]);

  // Enquanto o mês novo não tem fonte, fica na tela o último retrato completo,
  // sob a opacidade de 35% e o fio de progresso. Ajuste de estado durante o
  // render, guardado por condição, como no Operacional: efeito com setState e
  // ref lido no render são recusados pelo lint react-hooks v7.
  const ready = curLoaded.hasSource && (!compareOn || Boolean(cmpLoaded?.hasSource));
  const [lastGood, setLastGood] = useState(null);
  if (ready && (lastGood?.cur !== curLoaded || lastGood?.cmp !== cmpLoaded)) {
    setLastGood({ cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded });
  }
  const { cur, cmp, series, team } = ready || !lastGood
    ? { cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded }
    : lastGood;

  // O cabeçalho e a barra descrevem o que está escolhido, mesmo enquanto carrega.
  const pickedName = monthLabel(monthKey, { capitalized: false, withYear: false });
  const { subline, note } = regimeTexts({
    running: monthKey === currentKey, compareOn, dayN: now.getDate(), shownName: pickedName,
    cmpName: monthName(cmpKey, monthKey), apptsPartial: monthKey < APPTS_COMPLETE_MONTH
  });
  // O corpo, sob o véu enquanto o mês novo carrega, fala do retrato que está
  // nele, então os nomes saem de cur e cmp. Com o mês novo pronto, são os
  // mesmos da escolha.
  const shownName = monthLabel(cur.monthKey, { capitalized: false, withYear: false });
  const cmpName = cmp ? monthName(cmp.monthKey, cur.monthKey) : monthName(cmpKey, monthKey);
  const highlights = useMemo(
    () => (compareOn ? buildCrmHighlights(cur, cmp, { cmpName }) : []),
    [compareOn, cur, cmp, cmpName]
  );

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );
  const cmpOptions = compareOptions(monthKey).map((k) => ({ key: k, label: monthLabel(k) }));
  const people = users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' }));
  const personUser = userId ? users.find((u) => u.id === userId) : null;
  const funnelObj = funnelId ? leadFunnels.find((f) => f.id === funnelId) : null;
  const changeMonth = (k) => { setMonthKey(k); setCompareKey(null); };
  // Clicar na linha da pessoa filtra; clicar de novo na mesma linha limpa.
  const pickPerson = (id) => setPerson((p) => (p === id ? 'all' : id));
  // Qualquer mês carregado que falhou avisa: a safra do mês exibido também
  // depende dos meses seguintes (matrículas, perdas e agendamentos).
  const failedNames = sources.failedKeys.map((k) => monthName(k, monthKey));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="-m-4 md:-m-8 font-sans">
        <header className="bg-card px-4 md:px-8 pb-4 pt-5">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">CRM</h2>
          <p className="mt-[5px] max-w-[860px] text-[12.5px] leading-normal text-muted-foreground">{subline}</p>
        </header>
        <CrmToolbar
          monthKey={monthKey} monthOptions={monthOptions} onMonth={changeMonth}
          canPrev={monthKey > oldestKey} onPrev={() => { if (monthKey > oldestKey) changeMonth(addMonthsToKey(monthKey, -1)); }}
          canNext={monthKey < currentKey} onNext={() => { if (monthKey < currentKey) changeMonth(addMonthsToKey(monthKey, 1)); }}
          compareOn={compareOn} onCompareOn={setCompareOn}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={setCompareKey}
          person={userId || 'all'} people={people} onPerson={setPerson}
          funnel={funnelId || 'all'} funnels={leadFunnels} onFunnel={setFunnel}
          note={note}
        />
        {failedNames.length > 0 && (
          <Notice>{`Não foi possível carregar os dados de ${failedNames.join(' e ')}. Recarregue a página para tentar de novo.`}</Notice>
        )}
        <div className="relative">
          {sources.loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-500/25" aria-hidden="true">
              <span className="block h-full w-2/5 bg-brand-600 motion-safe:animate-pulse" />
            </div>
          )}
          <div className={cn('transition-opacity', sources.loading && 'opacity-35')} aria-busy={sources.loading}>
            <CrmDashboard
              cur={cur}
              cmp={cmp}
              series={series}
              team={team}
              highlights={highlights}
              compareOn={compareOn}
              shownName={shownName}
              person={userId}
              personName={personUser?.name || 'Sem nome'}
              funnelId={funnelId}
              funnelName={funnelObj?.name || ''}
              onPick={pickPerson}
              onClear={() => setPerson('all')}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
