import { useEffect, useMemo, useRef, useState } from 'react';
import { faixaFor, inFoco, isAppt, pendingEntries, pickAgora, rankFoco, withSkipped } from '../../../lib/metaFoco.js';
import { dgDateKey } from '../../../lib/dailyGoal.js';
import { getLeadAppointmentDate } from '../../../lib/leads.js';
import { CATEGORY_ONE, FOCO_LABEL, factsOf, focoTabs, morningText, urgentText, whyOf } from '../../../lib/metaFocoTexts.js';
import { useAgoraShortcuts } from '../../../hooks/useAgoraShortcuts.js';
import { DESFAZER_MS, useConcluirComDesfazer } from '../../../hooks/useConcluirComDesfazer.js';
import { TabsContent } from '../../ui/tabs.jsx';
import { DiaStrip } from './DiaStrip.jsx';
import { AgoraCard } from './AgoraCard.jsx';
import { AvisoDesfazer, FaixaUrgente } from './FaixaUrgente.jsx';
import { DiaFechado, FilaDepois, FocoBar, FocoVazio, MetaVazia } from './FocoParts.jsx';

// A tela nova da Meta (Foco agora, mockup B), atrás do ?meta=nova até a
// virada. A faixa do topo, a barra "Foco em", o bloco Agora com a tarefa da vez
// e a fila "Depois". A lateral vem pronta da Meta (`aside`), porque usa peças
// que moram na DailyGoalView. Quem grava são os handlers da Meta.
//
// O Agora fica parado: a tela guarda a chave da tarefa escolhida pela última
// ação (clicar numa linha da fila, pular, voltar à ordem, trocar de foco, "Ir
// agora" da faixa) e o relógio nunca a troca. Só quando a tarefa some da lista
// (concluída, remarcada, dado novo) vale a primeira da ordem (pickAgora, em
// metaFoco.js). Quando algo mais urgente aparece, a faixa de urgência avisa em
// vez de trocar o Agora sozinha.
//
// O Concluir de Novo lead não pergunta mais: a tarefa sai na hora e o aviso
// embaixo dá 6 segundos para desfazer antes de gravar (useConcluirComDesfazer).
// As outras categorias concluem pelo pop-up de desfecho, que é a confirmação.
const NONE = [];
const HOLD_AFTER_PAUSE_MS = 3000;
const CALL_QUESTION_MS = 1500;
// O WhatsApp abre em outra aba na hora. Se em 5 s a aba não saiu de vista (o
// navegador barrou a aba nova), a pergunta desarma, para não aparecer na
// próxima vez que a pessoa trocar de janela por outro motivo.
const WHATSAPP_LEAVE_MS = 5000;
// O prazo do Desfazer passaria da meia-noite? Lê o relógio de verdade, e não o
// `now` da tela, que fica parado na pausa por inatividade.
const prazoViraODia = () => dgDateKey(new Date(Date.now() + DESFAZER_MS)) !== dgDateKey(new Date());

export function MetaFocoScreen({
  strip, processedLeads, now, sla, renewalCheckpoints, meId, foco, onFoco,
  totalSlots, doneSlots, volume, perfectDay, tomorrow, aside,
  onOutcome, onReschedule, onPostpone, onOutcomePopup, onConclude, onWhatsapp, onCall,
}) {
  const aviso = useConcluirComDesfazer();
  const opts = useMemo(() => ({ sla, renewalCheckpoints }), [sla, renewalCheckpoints]);
  const entries = useMemo(() => {
    const fora = new Set(aviso.escondidas);
    return pendingEntries(processedLeads).filter((e) => !fora.has(e.key));
  }, [processedLeads, aviso.escondidas]);
  const tabs = useMemo(() => focoTabs(entries, now, opts), [entries, now, opts]);
  // Pular e "Agora não" valem só no dia: a chave da tarefa (lead e categoria)
  // se repete no dia seguinte, e a aba fica aberta de um dia para o outro.
  const today = dgDateKey(now);
  const [skip, setSkip] = useState({ day: today, keys: [] });
  const skipped = skip.day === today ? skip.keys : NONE;
  const list = useMemo(
    () => withSkipped(rankFoco(entries.filter((e) => inFoco(e.slug, foco)), now, opts), skipped),
    [entries, foco, now, opts, skipped]
  );

  // A escolha do Agora. `foco` guarda em que foco ela foi feita: trocar de foco
  // é uma ação, e o Agora passa a ser o primeiro do foco novo.
  const [sel, setSel] = useState({ key: null, pinned: false, foco });
  const agora = pickAgora(list, sel.foco === foco ? sel.key : null);
  const agoraKey = agora ? agora.key : null;
  if (sel.key !== agoraKey || sel.foco !== foco) setSel({ key: agoraKey, pinned: false, foco });
  const pinned = sel.pinned && sel.key === agoraKey;

  // Escolher uma linha da fila leva o foco do teclado ao Agora, que rola para a
  // vista. O "Voltar à ordem sugerida", o "Ver todos", o "Ir agora" e a resposta
  // da pergunta de volta também, porque somem com o clique e o foco cairia no
  // body. O pedido só se cumpre quando o Agora já está na tela: o "Ver todos"
  // troca o endereço, e o Agora chega num render seguinte.
  const agoraRef = useRef(null);
  const focusAgora = useRef(false);
  useEffect(() => {
    if (!focusAgora.current || !agoraRef.current) return;
    focusAgora.current = false;
    agoraRef.current.focus();
  });

  // A faixa de urgência. "Agora não" guarda a tarefa com a classe em que foi
  // dispensada, e ela volta se a classe mudar (faixaFor). Na volta da pausa por
  // inatividade a faixa espera 3 s, para os dados novos chegarem antes de ela
  // avisar de algo que talvez já tenha sido feito em outra tela.
  const [dispensa, setDispensa] = useState({ day: today, map: new Map() });
  const dispensadas = dispensa.day === today ? dispensa.map : null;
  const [liveAntes, setLiveAntes] = useState(strip.live);
  const [segurando, setSegurando] = useState(false);
  if (liveAntes !== strip.live) {
    setLiveAntes(strip.live);
    setSegurando(strip.live);
  }
  useEffect(() => {
    if (!segurando) return undefined;
    const t = setTimeout(() => setSegurando(false), HOLD_AFTER_PAUSE_MS);
    return () => clearTimeout(t);
  }, [segurando]);
  const urgente = segurando ? null : faixaFor(list, agora, dispensadas);

  // A pergunta "Conversou com…?" na volta do contato. Depois do WhatsApp, ela
  // aparece quando a aba volta a ficar visível ou a janela volta a ter o foco
  // (o WhatsApp abre em outra aba ou no aplicativo). Depois da ligação, que
  // não tira a pessoa da aba, aparece 1,5 s depois do clique. Visita e aula
  // não perguntam: o próximo passo é o desfecho. Lead sem telefone de contato
  // não abre nada, e aí não há o que perguntar.
  const [retorno, setRetorno] = useState(null);
  if (retorno && retorno.key !== agoraKey) setRetorno(null);
  useEffect(() => {
    if (!retorno || retorno.pronto) return undefined;
    const pronto = () => setRetorno((r) => (r && r.key === retorno.key ? { ...r, pronto: true } : r));
    if (retorno.via === 'ligacao') {
      const t = setTimeout(pronto, CALL_QUESTION_MS);
      return () => clearTimeout(t);
    }
    let saiu = document.visibilityState === 'hidden';
    const sair = () => { saiu = true; };
    const voltar = () => { if (saiu) pronto(); };
    const onVis = () => (document.visibilityState === 'hidden' ? sair() : voltar());
    const desarma = setTimeout(() => {
      if (!saiu) setRetorno((r) => (r && r.key === retorno.key && !r.pronto ? null : r));
    }, WHATSAPP_LEAVE_MS);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', sair);
    window.addEventListener('focus', voltar);
    return () => {
      clearTimeout(desarma);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', sair);
      window.removeEventListener('focus', voltar);
    };
  }, [retorno]);
  const perguntar = Boolean(retorno?.pronto && agora && !isAppt(agora.slug));

  const pick = (e) => {
    focusAgora.current = true;
    setSel({ key: e.key, pinned: true, foco });
  };
  const skipAgora = () => {
    if (!agora) return;
    setSkip({ day: today, keys: [...skipped.filter((k) => k !== agora.key), agora.key] });
    setSel({ key: null, pinned: false, foco });
  };
  const unpin = () => {
    focusAgora.current = true;
    setSel({ key: null, pinned: false, foco });
  };
  const showAll = () => {
    focusAgora.current = true;
    onFoco('all');
  };
  const irAgora = () => {
    if (!urgente) return;
    focusAgora.current = true;
    setSel({ key: urgente.key, pinned: false, foco });
  };
  const agoraNao = () => {
    if (!urgente) return;
    // A faixa some com o botão em que o foco estava.
    focusAgora.current = true;
    const map = new Map(dispensadas || []);
    map.set(urgente.key, urgente.klass);
    setDispensa({ day: today, map });
  };

  const whatsapp = (lead) => {
    if (onWhatsapp(lead) && agora && !isAppt(agora.slug)) setRetorno({ key: agora.key, via: 'whatsapp', pronto: false });
  };
  const ligar = (lead) => {
    if (onCall(lead) && agora && !isAppt(agora.slug)) setRetorno({ key: agora.key, via: 'ligacao', pronto: false });
  };

  // Concluir: as categorias com pop-up concluem nele; o Novo lead sai da tela
  // na hora e grava quando o prazo do Desfazer passa. Nos últimos segundos do
  // dia grava na hora e sem Desfazer: a marca leva a hora do servidor, e a
  // gravação depois da meia-noite daria o feito ao dia seguinte.
  const concluir = (entry) => {
    const { lead, slug, key } = entry;
    if (onOutcomePopup(lead, slug)) return;
    focusAgora.current = true;
    if (prazoViraODia()) {
      onConclude(lead, slug, '');
      return;
    }
    aviso.agendar({
      esconder: key,
      texto: `Tarefa de ${lead.name || 'lead sem nome'} concluída.`,
      gravar: () => onConclude(lead, slug, '', { quiet: true }),
      desfazer: () => {
        focusAgora.current = true;
        setSel({ key, pinned: false, foco });
      },
    });
  };
  const retornoSim = () => {
    // A pergunta some com o "Sim". O foco vai ao Agora, e é para lá que ele
    // volta quando o pop-up de desfecho fecha.
    focusAgora.current = true;
    setRetorno(null);
    if (agora) concluir(agora);
  };
  const retornoNao = () => {
    focusAgora.current = true;
    setRetorno(null);
  };

  const appt = agora ? isAppt(agora.slug) : false;
  const apptAt = appt ? getLeadAppointmentDate(agora.lead) : null;
  const passou = Boolean(apptAt && apptAt < now);
  useAgoraShortcuts(agora ? {
    w: perguntar || (appt && !passou) ? null : () => whatsapp(agora.lead),
    l: perguntar || appt ? null : () => ligar(agora.lead),
    c: perguntar ? retornoSim : appt ? () => onOutcome(agora.lead, 'attended', agora.slug) : () => concluir(agora),
    n: perguntar || !appt ? null : () => onOutcome(agora.lead, 'no_show', agora.slug),
    s: skipAgora,
  } : null);

  const fila = agora ? list.filter((e) => e.key !== agora.key) : [];
  const morning = doneSlots === 0 ? morningText(entries) : '';

  let body;
  if (totalSlots === 0) body = <MetaVazia />;
  else if (entries.length === 0) body = <DiaFechado doneSlots={doneSlots} volume={volume} perfectDay={perfectDay} tomorrow={tomorrow} />;
  else if (!agora) body = <FocoVazio label={FOCO_LABEL[foco]} onAll={showAll} />;
  else {
    body = (
      <>
        {urgente && (
          <FaixaUrgente
            texto={urgentText(urgente, now)}
            passou={urgente.klass === 0}
            onIr={irAgora}
            onDepois={agoraNao}
          />
        )}
        <AgoraCard
          ref={agoraRef}
          entry={agora}
          why={whyOf(agora, now, opts)}
          facts={factsOf(agora, now, opts)}
          now={now}
          meId={meId}
          pinned={pinned}
          retorno={perguntar}
          onUnpin={unpin}
          onSkip={skipAgora}
          onOutcome={onOutcome}
          onReschedule={onReschedule}
          onPostpone={onPostpone}
          onGoalDone={() => concluir(agora)}
          onWhatsapp={whatsapp}
          onCall={ligar}
          onRetornoSim={retornoSim}
          onRetornoNao={retornoNao}
        />
        <FilaDepois items={fila} sla={sla} onPick={pick} whyOf={(e) => whyOf(e, now, opts)} />
      </>
    );
  }

  return (
    <div className="relative flex flex-col font-sans">
      <DiaStrip {...strip} />
      {morning && <p className="mt-3 px-1 text-[13.5px] text-muted-foreground">{morning}</p>}
      {/* O leitor de tela ouve a tarefa nova quando o Agora troca, e a faixa de
          urgência quando ela aparece. O texto da faixa conta os minutos, então
          a região diz só quem e o quê, para não ser relida a cada minuto. */}
      <p className="sr-only" aria-live="polite">{agora ? `Agora: ${agora.lead.name || 'lead sem nome'}, ${CATEGORY_ONE[agora.slug]}` : ''}</p>
      <p className="sr-only" aria-live="polite">{urgente ? `Mais urgente que o Agora: ${urgente.lead.name || 'lead sem nome'}, ${CATEGORY_ONE[urgente.slug]}` : ''}</p>
      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <FocoBar tabs={tabs} value={foco} onChange={onFoco}>
            {/* tabIndex -1: o Radix põe o painel no Tab, e aqui ele seria uma
                parada sem anel antes dos botões do Agora. */}
            <TabsContent value={foco} tabIndex={-1}>{body}</TabsContent>
          </FocoBar>
        </div>
        <aside aria-label="Painel do dia" className="flex min-w-0 flex-col gap-3.5">{aside}</aside>
      </div>
      <AvisoDesfazer aviso={aviso.pendente} onDesfazer={aviso.desfazer} onSegurar={aviso.segurar} />
    </div>
  );
}
