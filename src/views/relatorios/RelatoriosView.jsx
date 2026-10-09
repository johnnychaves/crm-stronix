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
import { leadFunnelsOf } from '../../lib/crm/scope.js';
import { relatoriosSection } from '../../lib/relatoriosRail.js';
import { loadState, reportMonthKeys } from '../../lib/relatorios/leads/janela.js';
import { exportFileName, compareTextOf } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport, apptsPartialOf } from '../../lib/relatorios/leads/conversao.js';
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
  // As datas da lista do ano de agora saem sem o ano.
  const year = now.getFullYear();

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
  // na tela sob o véu, junto com o período e o comparado dele: o "vs. Agosto" e
  // o aviso dos agendamentos falam dos números que estão na tela, e não do que
  // foi escolhido agora, como no painel CRM. Ajuste de estado no render,
  // guardado por condição, como no painel: o lint react-hooks v7 recusa efeito
  // com setState e ref lido no render. Ele só roda quando o report muda, e isso
  // só acontece quando o endereço, a carga ou o relógio de um minuto mudam: a
  // useCrmSources entrega os mesmos months e leadsById enquanto nada mudou, e
  // sem isso este ajuste não pararia de rodar.
  const current = report ? { secao, report, period, cmp } : null;
  const [lastGood, setLastGood] = useState(null);
  if (current && lastGood?.report !== report) setLastGood(current);
  const shown = current || (!failed && lastGood?.secao === secao ? lastGood : null);
  const veiled = !current && Boolean(shown);
  // O texto do comparado ("vs. os 14 primeiros dias de Agosto 2026") fala dos
  // números que estão na tela: sob o véu, é o do resultado velho.
  const compareText = shown ? compareTextOf(shown.period, shown.cmp) : null;

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
  const exportable = Boolean(shown) && !veiled && shown.report.exportRows.length > 0;
  const doExport = () => {
    if (!exportable) return;
    downloadCsv(exportFileName(secao, shown.period), toCsv(shown.report.exportRows, shown.report.exportColumns));
  };
  const exportAction = canExport ? <ExportButton onExport={doExport} disabled={!exportable} /> : null;

  return (
    <div className="animate-fade-in flex flex-col gap-6 font-sans lg:flex-row lg:items-start lg:gap-8">
      {/* A lista de relatórios sem título: o título da tela é o do cabeçalho do App.
          O top-0 faz a lista começar na altura da barra, parada ou rolando. */}
      <aside className="lg:sticky lg:top-0 lg:w-[232px] lg:shrink-0">
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
        {/* Uma região de estado só, sempre no DOM: o leitor de tela só anuncia o texto
            que entra numa região que já existia, então "carregando" e "não deu para
            carregar" aparecem aqui dentro, e não no lugar dela. */}
        <div role="status">
          {failed ? (
            <DashedNote title="Não deu para carregar o período." text="Confira a internet e abra a tela de novo." />
          ) : !shown ? (
            <p className="py-12 text-center text-[13px] text-muted-foreground">Carregando os números do período.</p>
          ) : null}
        </div>
        {!failed && shown && (
          // Sob o véu, o conteúdo velho não recebe foco nem leitura (inert), além de
          // ficar apagado e sem clique.
          <div
            aria-busy={veiled}
            inert={veiled}
            className={cn('transition-opacity motion-reduce:transition-none', veiled && 'pointer-events-none opacity-35')}
          >
            {secao === 'conversao' ? (
              <ConversaoSection
                report={shown.report}
                compareText={compareText}
                listId={listId}
                year={year}
                onCut={onCut}
                exportAction={exportAction}
                apptsPartial={apptsPartialOf(shown.period, shown.cmp)}
              />
            ) : (
              <EntradaSection report={shown.report} compareText={compareText} listId={listId} year={year} onCut={onCut} exportAction={exportAction} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
