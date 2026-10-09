// Tela dos Relatórios (spec docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md).
// Hoje, o relatório de Leads, com Entrada de leads e Conversão. O submenu vem
// do endereço (section, a sub-tela que o App lê) e o período e os filtros vêm
// da query (useScreenParams). As contas são as do painel CRM, em
// src/lib/relatorios/leads/, e a carga é a do painel (useCrmSources), com os
// meses do início do comparado até o mês atual. Desenhada com a skill
// frontend-design.
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { ACTIONS, can, isSeller } from '../../lib/acesso.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { useCrmSources } from '../../hooks/useCrmSources.js';
import { screenParamsQuery } from '../../lib/screenParams.js';
import { periodFromParams, previousPeriod } from '../../lib/period.js';
import { addMonthsToKey, dayKeyOf, monthKeyOf, monthLabel } from '../../lib/operacional/month.js';
import { APPTS_COMPLETE_MONTH, leadFunnelsOf } from '../../lib/crm/scope.js';
import { relatoriosSection } from '../../lib/relatoriosRail.js';
import { loadState, reportMonthKeys } from '../../lib/relatorios/leads/janela.js';
import { exportFileName } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport } from '../../lib/relatorios/leads/conversao.js';
import { downloadCsv, toCsv } from '../../lib/csvExport.js';
import { DashedNote } from '../dashboard/CrmParts.jsx';
import { RelatoriosRail } from './RelatoriosRail.jsx';
import { RelatoriosToolbar } from './RelatoriosToolbar.jsx';
import { ExportButton } from './ReportParts.jsx';
import { EntradaSection } from './EntradaSection.jsx';
import { ConversaoSection } from './ConversaoSection.jsx';

const REPORTS = Object.freeze({ entrada: entradaReport, conversao: conversaoReport });

export function RelatoriosView({
  db, appUser, usersList, funnels, sources, liveLeads, interactions, listenersActive = true, section, onSection,
}) {
  // Relógio da tela: vira o minuto (período em andamento e corte do comparado).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const currentKey = monthKeyOf(now);
  const todayKey = dayKeyOf(now);

  // Quem vende entra no filtro de consultores e nos nomes dos recortes.
  const users = useMemo(() => (usersList || []).filter((u) => u?.id && isSeller(u)), [usersList]);
  const people = useMemo(() => users.map((u) => ({ id: u.id, name: u.name || 'Sem nome' })), [users]);
  const leadFunnels = useMemo(() => leadFunnelsOf(funnels), [funnels]);
  const origens = useMemo(
    () => [...new Set((sources || []).map((s) => String(s?.name || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [sources]
  );
  const paramsCtx = useMemo(
    () => ({ currentKey, todayKey, users, podeResp: true, respPadrao: [], funis: leadFunnels, origens }),
    [currentKey, todayKey, users, leadFunnels, origens]
  );
  const [params, setParams] = useScreenParams('relatorios', paramsCtx);
  const { monthKey, periodo, de, ate, resp, origem, funnel, recorte } = params;

  const period = useMemo(() => periodFromParams({ periodo, de, ate, monthKey }, now), [periodo, de, ate, monthKey, now]);
  const cmp = useMemo(() => previousPeriod(period, now), [period, now]);
  // A lista vira texto antes do useMemo: o relógio refaz o período a cada
  // minuto, e a carga só pode mudar quando os meses mudam.
  const keysText = reportMonthKeys(period, cmp, currentKey).join(',');
  const monthKeys = useMemo(() => keysText.split(','), [keysText]);
  const src = useCrmSources({ db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads });
  const load = loadState(src.months, monthKeys);
  const failed = load.failed || (src.failedKeys || []).length > 0;
  const ready = !src.loading && load.ready && !failed;

  const secao = relatoriosSection(section);
  const ctx = useMemo(
    () => ({ now, users, funnels: funnels || [], sources: sources || [], months: src.months, leadsById: src.leadsById }),
    [now, users, funnels, sources, src.months, src.leadsById]
  );
  const funnelId = funnel === 'all' ? null : funnel;
  const report = useMemo(
    () => (ready ? REPORTS[secao](ctx, { period, cmp, userIds: resp, funnelId, origem, recorte }) : null),
    [ready, secao, ctx, period, cmp, resp, funnelId, origem, recorte]
  );

  // Enquanto o período novo carrega, o último resultado do mesmo submenu fica
  // na tela sob o véu. Ajuste de estado no render, guardado por condição, como
  // no painel CRM: o lint react-hooks v7 recusa efeito com setState e ref lido
  // no render.
  const [lastGood, setLastGood] = useState(null);
  if (report && lastGood?.report !== report) setLastGood({ secao, report });
  const shown = report || (!failed && lastGood?.secao === secao ? lastGood.report : null);
  const veiled = !report && Boolean(shown);

  // Que lista é esta: o submenu mais o endereço (período, filtros e o recorte da
  // lista). Quando muda, a lista volta aos 50 primeiros. Sai dos filtros do
  // endereço, e não do relógio de um minuto nem dos dados, então um lead novo
  // que chega ao vivo não fecha o "Mostrar mais". É texto de propósito (um array
  // seria outro a cada render), e nunca entra numa key: a lista tem de continuar
  // montada quando o filtro troca, para o foco ir ao número dela.
  const listId = `${secao}${screenParamsQuery('relatorios', params, paramsCtx)}`;

  // Trocar de submenu leva o período e os filtros junto, sem o recorte da
  // lista, que é de cada submenu.
  const goSection = (id) => onSection(id, screenParamsQuery('relatorios', { ...params, recorte: null }, paramsCtx));
  const onCut = (code) => setParams({ recorte: code });
  const onPeriod = (kind) => setParams(kind === 'mes'
    ? { periodo: null, de: null, ate: null, monthKey: currentKey }
    : { periodo: kind, de: null, ate: null });
  const onRange = (d, a) => setParams({ periodo: null, de: d, ate: a });
  const shownMonth = period.monthKey || currentKey;
  const oldestKey = addMonthsToKey(currentKey, -11);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthLabel(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );

  const canExport = can(appUser, ACTIONS.RELATORIOS_EXPORTAR);
  const exportable = Boolean(shown) && !veiled && shown.exportRows.length > 0;
  const doExport = () => {
    if (!exportable) return;
    downloadCsv(exportFileName(secao, period), toCsv(shown.exportRows, shown.exportColumns));
  };
  const exportAction = canExport ? <ExportButton onExport={doExport} disabled={!exportable} /> : null;

  return (
    <div className="animate-fade-in flex flex-col gap-6 font-sans lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:sticky lg:top-20 lg:w-[232px] lg:shrink-0">
        <div className="mb-4 lg:px-3">
          <h1 className="m-0 font-display text-[17px] font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">Os números do período e os nomes por trás deles.</p>
        </div>
        <RelatoriosRail section={secao} onSection={goSection} />
      </aside>
      <div className="min-w-0 flex-1">
        <RelatoriosToolbar
          period={period}
          todayKey={todayKey}
          onPeriod={onPeriod}
          onRange={onRange}
          monthKey={shownMonth}
          monthOptions={monthOptions}
          onMonth={(k) => setParams({ monthKey: k })}
          canPrev={shownMonth > oldestKey}
          canNext={shownMonth < currentKey}
          onPrev={() => setParams({ monthKey: addMonthsToKey(shownMonth, -1) })}
          onNext={() => setParams({ monthKey: addMonthsToKey(shownMonth, 1) })}
          resp={resp}
          people={people}
          onResp={(ids) => setParams({ resp: ids })}
          origem={origem}
          origens={origens}
          onOrigem={(v) => setParams({ origem: v })}
          funnel={funnel}
          funnels={leadFunnels}
          onFunnel={(v) => setParams({ funnel: v })}
        />
        {failed ? (
          <DashedNote title="Não deu para carregar o período." text="Confira a internet e abra a tela de novo." />
        ) : !shown ? (
          <p role="status" className="py-12 text-center text-[13px] text-muted-foreground">Carregando os números do período.</p>
        ) : (
          <div
            aria-busy={veiled}
            className={cn('transition-opacity motion-reduce:transition-none', veiled && 'pointer-events-none opacity-35')}
          >
            {secao === 'conversao' ? (
              <ConversaoSection
                report={shown}
                cmp={cmp}
                listId={listId}
                onCut={onCut}
                exportAction={exportAction}
                apptsPartial={monthKeyOf(period.start) < APPTS_COMPLETE_MONTH}
              />
            ) : (
              <EntradaSection report={shown} cmp={cmp} listId={listId} onCut={onCut} exportAction={exportAction} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
