// Tela OPERACIONAL (Visão geral · Operacional): o trabalho feito e a saúde da
// base de clientes, por mês de competência, igual para todos os perfis, com
// comparativo e filtro de pessoa. Desenho do mockup D, "Duas metas"
// (docs/superpowers/specs/mockups/2026-10-15-operacional-d-duas-metas.html):
// as duas metas por pessoa no topo e as faixas abaixo, no padrão do CRM e do
// Gerencial. Toda a matemática vem de src/lib/operacional/ (metricsOf); aqui é
// só orquestração.

import { useEffect, useMemo, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { useOperacionalSources } from '../../hooks/useOperacionalSources.js';
import { normalizeContracts } from '../../lib/operacional/base.js';
import { monthKeyOf, monthRange, addMonthsToKey, comparisonCut, compareOptions, monthLabel } from '../../lib/operacional/month.js';
import { metricsOf, seriesOf, milestoneMonthsAfter } from '../../lib/operacional/metrics.js';
import { normalizeCheckpoints } from '../../lib/operacional/renewal.js';
import { cn } from '../../lib/utils.js';
import { OperacionalToolbar } from './OperacionalToolbar.jsx';
import { OperacionalDashboard } from './OperacionalDashboard.jsx';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { isSeller } from '../../lib/acesso.js';

// Padrões fora do componente: um array novo a cada render mudaria os memos.
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const DEFAULT_CHECKPOINTS = [90, 60, 30];

// Mês em texto corrido: "agosto", ou "setembro de 2025" quando o ano é outro.
const monthName = (key, refKey) => {
  const name = monthLabel(key, { capitalized: false, withYear: false });
  return key.slice(0, 4) === refKey.slice(0, 4) ? name : `${name} de ${key.slice(0, 4)}`;
};

// Aviso sob o cabeçalho, quando algum número da tela não é o completo (mês
// que não carregou, meta só da própria pessoa).
function Notice({ children }) {
  return (
    <p role="status" className="flex items-center gap-1.5 px-4 pt-1 text-[12px] text-amber-700 md:px-8 dark:text-amber-300">
      <CircleAlert size={13} strokeWidth={2.2} className="flex-none" />
      {children}
    </p>
  );
}

function DashboardOperacionalView({ appUser, usersList, liveLeads, interactions, db, listenersActive = true }) {
  const {
    contratos,
    metaWeekdays = DEFAULT_WEEKDAYS,
    renewalCheckpoints = DEFAULT_CHECKPOINTS,
    renewalGraceDays = 15
  } = useGeneralConfig();

  // Relógio da tela: vira o minuto (marca de hoje, mês em andamento, pró-rata).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentKey = monthKeyOf(now);
  // As linhas por pessoa, o seletor de pessoa e o endereço são de quem vende.
  // O que o professor registra (anotação, agendamento) entra só nos totais da
  // equipe, como o de quem saiu da equipe.
  const users = useMemo(() => (usersList || []).filter((u) => u?.id && isSeller(u)), [usersList]);
  // Mês, comparativo e pessoa vêm do endereço: F5 mantém, o link abre igual e
  // cada aba pode estar num recorte diferente. Pessoa que saiu da equipe e mês
  // fora da janela de 12 meses caem no padrão, sem aviso (src/lib/screenParams.js).
  const paramsCtx = useMemo(() => ({ currentKey, users }), [currentKey, users]);
  const [{ monthKey, compareOn, compareKey, person }, setParams] = useScreenParams('dashOperacional', paramsCtx);
  const userId = person === 'all' ? null : person;
  const cmpKey = compareKey || addMonthsToKey(monthKey, -1);
  // A lista de meses vai até 11 meses atrás; a seta não passa dela.
  const oldestKey = addMonthsToKey(currentKey, -11);

  const seriesKeys = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonthsToKey(monthKey, i - 5)), [monthKey]);
  // Mês exibido fechado: cada marco conta até o marco seguinte, e o intervalo
  // passa do fim do mês (um mês, ou mais com marcos espaçados como 90 e 30).
  // O metricsOf deixa os marcos sem número sem as interações dos meses que ele
  // alcança, então eles entram na carga, até o mês corrente.
  const monthKeys = useMemo(() => {
    const after = milestoneMonthsAfter(monthKey, { checkpoints: renewalCheckpoints, asOf: monthRange(currentKey).end });
    return [...new Set([...seriesKeys, cmpKey, ...after])];
  }, [seriesKeys, cmpKey, monthKey, currentKey, renewalCheckpoints]);
  // A lista inteira de uma vez: a pausa do contrato trancado que ganhou
  // sucessor só fecha olhando os outros contratos da pessoa.
  const contracts = useMemo(() => normalizeContracts(contratos), [contratos]);
  const personUser = userId ? users.find((u) => u.id === userId) || null : null;

  const sources = useOperacionalSources({
    db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads, contracts, appUser
  });

  const config = useMemo(
    () => ({ metaWeekdays, renewalCheckpoints, renewalGraceDays }),
    [metaWeekdays, renewalCheckpoints, renewalGraceDays]
  );
  // Assinatura do histórico só da própria pessoa (regra antiga, ou a da equipe
  // negada depois das novas tentativas): só ela tem número de meta. Se nem a
  // dela responde, ninguém tem, e a meta aparece como indisponível.
  const historyOwnerOnly = sources.historyScope === 'own' ? (appUser?.id ?? '') : null;
  const historyUnavailable = Boolean(sources.historyFailed);
  const ctx = useMemo(() => ({
    now, users, contracts, liveLeads, config, historyOwnerOnly, historyUnavailable,
    leadsById: sources.leadsById,
    months: sources.months
  }), [now, users, contracts, liveLeads, config, historyOwnerOnly, historyUnavailable, sources.leadsById, sources.months]);

  const curLoaded = useMemo(() => metricsOf(ctx, { monthKey, userId }), [ctx, monthKey, userId]);
  const cmpLoaded = useMemo(
    () => (compareOn ? metricsOf(ctx, { monthKey: cmpKey, userId, cutEnd: comparisonCut(monthKey, cmpKey, now) }) : null),
    [compareOn, ctx, cmpKey, userId, monthKey, now]
  );
  const seriesLoaded = useMemo(() => ({
    active: seriesOf(ctx, { monthKey, pick: (m) => m.base.active })
  }), [ctx, monthKey]);
  // As linhas do topo: uma por pessoa, ou só a da pessoa filtrada.
  const teamLoaded = useMemo(
    () => (userId ? users.filter((u) => u.id === userId) : users).map((u) => ({ user: u, m: metricsOf(ctx, { monthKey, userId: u.id }) })),
    [ctx, monthKey, userId, users]
  );

  // Trocar de mês pede a fonte de novo (interações, leads, histórico); até ela
  // chegar, o mês novo tem hasSource falso e todo campo que depende dela
  // (calendário, prospecção, tarefas, marcos) vem vazio — sem isto a tela
  // mostrava o mês vazio na hora, o calendário encolhia e o layout saltava.
  // Mantém o último retrato completo (cur+cmp+series+team) que tinha fonte na
  // tela, sob a mesma opacidade de 35% e o fio de progresso que já existiam
  // (README "Carregando"), até o mês novo ter fonte.
  // Ajuste de estado durante o render, guardado por condição (padrão aceito
  // pelo React para "adaptar estado numa troca de props/seleção" sem efeito):
  // um useEffect chamando setState seria pego pelo react-hooks/set-state-in-
  // effect, e um useRef lido/escrito aqui seria pego pelo react-hooks/refs —
  // os dois testados e recusados por este lint antes desta escolha.
  const ready = curLoaded.hasSource && (!compareOn || Boolean(cmpLoaded?.hasSource));
  // cur, series e team mudam juntos (mesmas dependências); cmp muda sozinho
  // quando só o mês de comparação troca. A guarda depende de ctx estável entre
  // renders: dentro do App a config vem do provider memorizado.
  const [lastGood, setLastGood] = useState(null);
  if (ready && (lastGood?.cur !== curLoaded || lastGood?.cmp !== cmpLoaded)) {
    setLastGood({ cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded });
  }
  const { cur, cmp, series, team } = ready || !lastGood
    ? { cur: curLoaded, cmp: cmpLoaded, series: seriesLoaded, team: teamLoaded }
    : lastGood;

  // O cabeçalho descreve o que está escolhido, mesmo enquanto carrega; o
  // corpo, sob o véu, fala do retrato que está nele (cur e cmp).
  const dayN = now.getDate();
  const pickedName = monthLabel(monthKey, { capitalized: false, withYear: false });
  const pickedRunning = monthKey === currentKey;
  const range = pickedRunning ? (dayN === 1 ? `1 de ${pickedName}` : `1 a ${dayN} de ${pickedName}`) : `${pickedName} inteiro`;
  const firstDays = dayN === 1 ? 'o primeiro dia' : `os ${dayN} primeiros dias`;
  const pickedCmp = monthName(cmpKey, monthKey);
  const subline = compareOn
    ? (pickedRunning
      ? `${range} comparado com ${firstDays} de ${pickedCmp}. O mês está em andamento, então a comparação é pró-rata.`
      : `${range} comparado com ${pickedCmp}. Mês fechado.`)
    : (pickedRunning ? `${range}. O mês está em andamento: hoje conta à parte.` : `${range}. Mês fechado.`);
  const shownName = monthLabel(cur.monthKey, { capitalized: false, withYear: false });
  const cmpName = cmp ? monthName(cmp.monthKey, cur.monthKey) : pickedCmp;

  // Mês cuja busca falhou em todas as tentativas entra vazio: avisa, em vez de
  // deixar o zero passar por número do mês.
  const failedNames = [monthKey, ...(compareOn ? [cmpKey] : [])]
    .filter((k) => sources.failedKeys.includes(k))
    .map((k) => monthName(k, monthKey));

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );
  const cmpOptions = compareOptions(monthKey).map((k) => ({ key: k, label: monthLabel(k) }));
  const people = users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' }));
  // Trocar de mês zera o mês da comparação, como sempre zerou. É uma navegação
  // só: os dois parâmetros trocam juntos.
  const changeMonth = (k) => setParams({ monthKey: k, compareKey: null });
  // O nome no topo filtra a tela; clicar de novo no mesmo nome volta à equipe.
  const pickPerson = (id) => setParams((v) => ({ person: v.person === id ? 'all' : id }));
  // Marcos ainda sem fonte (mês carregando): uma linha por marco, sem número.
  const milestoneItems = cur.milestones || normalizeCheckpoints(renewalCheckpoints)
    .map((days) => ({ days, done: null, total: null, pct: null }));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="-m-4 md:-m-8 font-sans">
        <OperacionalToolbar
          title="Operacional" subline={subline}
          monthKey={monthKey} monthOptions={monthOptions} onMonth={changeMonth}
          canPrev={monthKey > oldestKey} onPrev={() => { if (monthKey > oldestKey) changeMonth(addMonthsToKey(monthKey, -1)); }}
          canNext={monthKey < currentKey} onNext={() => { if (monthKey < currentKey) changeMonth(addMonthsToKey(monthKey, 1)); }}
          compareOn={compareOn} onCompareOn={(v) => setParams({ compareOn: v })}
          compareKey={cmpKey} compareOptions={cmpOptions} onCompare={(k) => setParams({ compareKey: k })}
          person={person} people={people} onPerson={(id) => setParams({ person: id })}
        />
        {failedNames.length > 0 && (
          <Notice>Não foi possível carregar os dados de {failedNames.join(' e ')}. Recarregue a página para tentar de novo.</Notice>
        )}
        {historyUnavailable ? (
          <Notice>A meta diária não carregou. Recarregue a página para tentar de novo.</Notice>
        ) : historyOwnerOnly !== null && (
          <Notice>A meta dos colegas não carregou. Por enquanto, a meta diária mostra só a sua.</Notice>
        )}
        <div className="relative">
          {sources.loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-500/25" aria-hidden="true">
              <span className="block h-full w-2/5 bg-brand-600 motion-safe:animate-pulse" />
            </div>
          )}
          <div className={cn('transition-opacity', sources.loading && 'opacity-35')} aria-busy={sources.loading}>
            <OperacionalDashboard
              cur={cur}
              cmp={cmp}
              series={series}
              team={team}
              compareOn={compareOn}
              shownName={shownName}
              cmpName={cmpName}
              person={userId}
              personName={personUser?.name || 'Sem nome'}
              milestoneItems={milestoneItems}
              onPick={pickPerson}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export { DashboardOperacionalView };
