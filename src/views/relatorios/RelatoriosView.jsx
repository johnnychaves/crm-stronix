// Tela dos Relatórios (spec docs/superpowers/specs/2026-10-09-relatorios-de-leads-design.md).
// Hoje, o relatório de Leads, com cinco submenus: Entrada de leads, Conversão,
// Visitas e aulas experimentais, Perdas e Leads parados. O submenu vem do
// endereço (section, a sub-tela que o App lê) e o período e os filtros vêm da
// query (useScreenParams). As contas são as do painel CRM, em
// src/lib/relatorios/leads/, e a carga é a do painel (useCrmSources), com os
// meses do início do comparado até o mês atual. Leads parados é retrato de
// agora: não pede mês nenhum e lê os leads em aberto que o app já tem
// (liveLeads) e as interações do mês que chegam ao vivo. Desenhada com a skill
// frontend-design, no molde do handoff em
// docs/superpowers/specs/handoff-relatorios/.
//
// A lista ao lado mostra só o nome de cada relatório, sem número (decisão do
// Johnny, 15/10/2026).
//
// O Imprimir monta a folha impressa (ReportPrint) só durante a impressão: o
// clique preenche a ficha, a folha entra no body na hora (flushSync) e o
// afterprint a tira.
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router';
import { cn } from '../../lib/utils.js';
import { ACTIONS, can, isSeller } from '../../lib/acesso.js';
import { useScreenParams } from '../../hooks/useScreenParams.js';
import { useCrmSources } from '../../hooks/useCrmSources.js';
import { screenParamsQuery } from '../../lib/screenParams.js';
import { periodFromParams, previousPeriod } from '../../lib/period.js';
import { addMonthsToKey, dayKeyOf, monthKeyOf, monthText } from '../../lib/operacional/month.js';
import { leadFunnelsOf } from '../../lib/crm/scope.js';
import { relatoriosSection } from '../../lib/relatoriosRail.js';
import { hrefFor, parseAppPath } from '../../lib/routes.js';
import { loadState, reportMonthKeys } from '../../lib/relatorios/leads/janela.js';
import { exportFileName, snapshotFileName, compareTextOf, apptsPartialOf } from '../../lib/relatorios/leads/base.js';
import { entradaReport } from '../../lib/relatorios/leads/entrada.js';
import { conversaoReport } from '../../lib/relatorios/leads/conversao.js';
import { visitasReport } from '../../lib/relatorios/leads/visitas.js';
import { perdasReport } from '../../lib/relatorios/leads/perdas.js';
import { paradosReport } from '../../lib/relatorios/leads/parados.js';
import { ReportPrintContext, printSheetOf } from '../../lib/relatorios/leads/impressao.js';
import { downloadCsv, toCsv } from '../../lib/csvExport.js';
import { DashedNote } from '../dashboard/CrmParts.jsx';
import { RelatoriosRail } from './RelatoriosRail.jsx';
import { RelatoriosToolbar } from './RelatoriosToolbar.jsx';
import { ExportButton, PrintButton } from './ReportParts.jsx';
import { EntradaSection } from './EntradaSection.jsx';
import { ConversaoSection } from './ConversaoSection.jsx';
import { VisitasSection } from './VisitasSection.jsx';
import { PerdasSection } from './PerdasSection.jsx';
import { ParadosSection } from './ParadosSection.jsx';

// A conta e a tela de cada submenu, pelo id do endereço (RELATORIOS_SUBS).
const REPORTS = Object.freeze({
  entrada: entradaReport,
  conversao: conversaoReport,
  'visitas-e-aulas': visitasReport,
  perdas: perdasReport,
  parados: paradosReport,
});
const SECTIONS = Object.freeze({
  entrada: EntradaSection,
  conversao: ConversaoSection,
  'visitas-e-aulas': VisitasSection,
  perdas: PerdasSection,
  parados: ParadosSection,
});
// O retrato de agora: sem período na barra, sem mês para carregar e com o dia de hoje no nome do arquivo.
const SNAPSHOT = 'parados';

export function RelatoriosView({
  db, appUser, usersList, funnels, sources, liveLeads, interactions, listenersActive = true, section, onSection, tenantName = '',
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
  const { monthKey, periodo, de, ate, dias, resp, origem, funnel, recorte } = params;

  const secao = relatoriosSection(section);
  const snapshot = secao === SNAPSHOT;
  const period = useMemo(() => periodFromParams({ periodo, de, ate, monthKey }, now), [periodo, de, ate, monthKey, now]);
  const cmp = useMemo(() => previousPeriod(period, now), [period, now]);
  // A lista vira texto antes do useMemo: o relógio refaz o período a cada
  // minuto, e a carga só pode mudar quando os meses mudam. Leads parados não
  // pede mês: com a lista vazia, a carga fica pronta na hora.
  const keysText = snapshot ? '' : reportMonthKeys(period, cmp, currentKey).join(',');
  const monthKeys = useMemo(() => (keysText ? keysText.split(',') : []), [keysText]);
  const src = useCrmSources({ db, enabled: listenersActive, now, monthKeys, liveInteractions: interactions, liveLeads });
  const load = loadState(src.months, monthKeys);
  const failed = load.failed || (src.failedKeys || []).length > 0;
  const ready = !src.loading && load.ready && !failed;

  const ctx = useMemo(
    () => ({
      now, users, funnels: funnels || [], sources: sources || [], months: src.months, leadsById: src.leadsById, liveLeads, interactions,
    }),
    [now, users, funnels, sources, src.months, src.leadsById, liveLeads, interactions]
  );
  const funnelId = funnel === 'all' ? null : funnel;
  // O relatório se refaz a cada clique num número, a cada minuto e a cada período
  // novo. A parte pesada, o índice das interações, não vai junto: o reportIndex
  // o guarda pelo objeto de meses e só o refaz quando os meses mudam.
  const report = useMemo(
    () => (ready ? REPORTS[secao](ctx, { period, cmp, userIds: resp, funnelId, origem, recorte, dias }) : null),
    [ready, secao, ctx, period, cmp, resp, funnelId, origem, recorte, dias]
  );

  // Enquanto o período novo carrega, o último resultado do mesmo submenu fica
  // na tela sob o véu, junto com o período e o comparado dele: o "vs. agosto" e
  // o aviso dos agendamentos falam dos números que estão na tela, e não do que
  // foi escolhido agora, como no painel CRM. Ajuste de estado no render,
  // guardado por condição, como no painel: o lint react-hooks v7 recusa efeito
  // com setState e ref lido no render. Ele só roda quando o report muda, e isso
  // só acontece quando o endereço, a carga ou o relógio de um minuto mudam: a
  // useCrmSources entrega os mesmos months e leadsById enquanto nada mudou, e
  // sem isso este ajuste não pararia de rodar.
  // O mesmo relatório de período sem o recorte da lista: dá as linhas do
  // gráfico por dia, que é o total distribuído e não muda quando um número ou
  // uma linha de recorte filtra a lista.
  const uncutReport = useMemo(
    () => (ready && !snapshot ? REPORTS[secao](ctx, { period, cmp, userIds: resp, funnelId, origem }) : null),
    [ready, snapshot, secao, ctx, period, cmp, resp, funnelId, origem]
  );
  const current = report ? { secao, report, period, cmp, allRows: (uncutReport ?? report).rows } : null;
  const [lastGood, setLastGood] = useState(null);
  if (current && lastGood?.report !== report) setLastGood(current);
  const shown = current || (!failed && lastGood?.secao === secao ? lastGood : null);
  const veiled = !current && Boolean(shown);
  // O texto do comparado ("vs. os 14 primeiros dias de agosto de 2026") fala dos
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
  // lista, que é de cada submenu. Clicar no submenu que já está aberto não
  // troca nada: o App navegaria para o mesmo endereço sem o recorte, e a lista
  // perderia o filtro sem ninguém ter pedido. O seletor do celular já só avisa
  // quando o valor muda. O link de cada item leva o mesmo endereço, para o
  // Ctrl+clique abrir o submenu em outra aba com o período e os filtros.
  const sectionQuery = screenParamsQuery('relatorios', { ...params, recorte: null }, paramsCtx);
  const { pathname } = useLocation();
  const tenantSlug = parseAppPath(pathname).tenantSlug;
  const hrefOf = (id) => `${hrefFor(tenantSlug, 'relatorios', { sub: id }) || pathname}${sectionQuery}`;
  const goSection = (id) => {
    if (id === secao) return;
    onSection(id, sectionQuery);
  };

  // O período da barra, no meio da frase da lista ("5 relatórios, outubro de
  // 2026"): o mês sem o "em andamento", que a barra já diz. Leads parados não tem período.
  const railPeriodLabel = snapshot ? null
    : period.kind === 'mes' ? monthText(period.monthKey, { capitalized: false }) : period.label.toLowerCase();
  const onCut = (code) => setParams({ recorte: code });
  const onPeriod = (kind) => setParams(kind === 'mes'
    ? { periodo: null, de: null, ate: null, monthKey: currentKey }
    : { periodo: kind, de: null, ate: null });
  const onRange = (d, a) => setParams({ periodo: null, de: d, ate: a });
  const shownMonth = period.monthKey || currentKey;
  const oldestKey = addMonthsToKey(currentKey, -11);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonthsToKey(currentKey, -i))
      .map((k) => ({ key: k, label: `${monthText(k)}${k === currentKey ? ' · em andamento' : ''}` })),
    [currentKey]
  );

  const canExport = can(appUser, ACTIONS.RELATORIOS_EXPORTAR);
  const exportable = Boolean(shown) && !veiled && shown.report.exportRows.length > 0;
  // O arquivo leva as datas que a lista cobre: as do período, ou as da janela das
  // Visitas e aulas, que vai até o fim do período; em Leads parados, o dia de hoje.
  const doExport = () => {
    if (!exportable) return;
    const fileName = snapshot ? snapshotFileName(secao, now) : exportFileName(secao, shown.report.window || shown.period);
    downloadCsv(fileName, toCsv(shown.report.exportRows, shown.report.exportColumns));
  };

  // A hora do clique em Imprimir, enquanto a folha impressa existe.
  const [printAt, setPrintAt] = useState(null);
  useEffect(() => {
    const done = () => setPrintAt(null);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);
  const doPrint = () => {
    if (!exportable) return;
    flushSync(() => setPrintAt(new Date()));
    window.print();
  };
  const funnelName = funnel === 'all' ? null : leadFunnels.find((f) => f.id === funnel)?.name || null;
  const printSheet = printAt && shown
    ? printSheetOf({
      secao,
      report: shown.report,
      period: snapshot ? null : shown.period,
      listWindow: shown.report.window,
      baseTotal: snapshot ? shown.report.total : shown.allRows.length,
      consultor: people.filter((p) => resp.includes(p.id)).map((p) => p.name).join(', ') || 'Equipe toda',
      origem,
      funil: funnelName,
      academy: tenantName,
      author: appUser?.name || '',
      at: printAt,
    })
    : null;
  const exportAction = canExport ? (
    <div className="flex flex-none items-center gap-2">
      <PrintButton onPrint={doPrint} disabled={!exportable} />
      <ExportButton onExport={doExport} disabled={!exportable} />
    </div>
  ) : null;
  // A tela do submenu do resultado que está na tela (o de agora ou o de sob o véu, que é sempre o mesmo submenu).
  const Section = SECTIONS[secao];

  return (
    <div className="animate-fade-in flex flex-col gap-6 font-sans lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-7">
      {/* A lista de relatórios sem título: o título da tela é o do cabeçalho do App. */}
      <aside className="lg:sticky lg:top-6">
        <RelatoriosRail section={secao} onSection={goSection} hrefOf={hrefOf} periodLabel={railPeriodLabel} />
      </aside>
      <div className="min-w-0 flex-1">
        <RelatoriosToolbar
          showPeriod={!snapshot}
          dias={dias}
          onDias={(v) => setParams({ dias: v })}
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
          // ficar apagado e sem clique. O scroll-mt-32 vale para o que recebe foco
          // aqui dentro: quem volta com Shift+Tab faz o navegador rolar o item até o
          // topo da área que rola, e sem a margem ele ficava escondido atrás da barra
          // fixa (medido a 1280px: 15 de 40 paradas atrás da barra). Os 128px cobrem
          // a barra em uma ou duas linhas. A barra fica fora daqui: ela não rola.
          <div
            aria-busy={veiled}
            inert={veiled}
            className={cn(
              'transition-opacity motion-reduce:transition-none [&_:is(a,button,[tabindex])]:scroll-mt-32',
              veiled && 'pointer-events-none opacity-35'
            )}
          >
            <ReportPrintContext.Provider value={printSheet}>
              <Section
                report={shown.report}
                compareText={compareText}
                listId={listId}
                year={year}
                onCut={onCut}
                exportAction={exportAction}
                apptsPartial={apptsPartialOf(shown.period, shown.cmp)}
                allRows={shown.allRows}
                period={shown.period}
                now={now}
              />
            </ReportPrintContext.Provider>
          </div>
        )}
      </div>
    </div>
  );
}
