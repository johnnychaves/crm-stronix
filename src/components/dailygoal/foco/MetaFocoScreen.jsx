import { useEffect, useMemo, useRef, useState } from 'react';
import { inFoco, pendingEntries, pickAgora, rankFoco, withSkipped } from '../../../lib/metaFoco.js';
import { CATEGORY_ONE, FOCO_LABEL, factsOf, focoTabs, morningText, whyOf } from '../../../lib/metaFocoTexts.js';
import { TabsContent } from '../../ui/tabs.jsx';
import { DiaStrip } from './DiaStrip.jsx';
import { AgoraCard } from './AgoraCard.jsx';
import { DiaFechado, FilaDepois, FocoBar, FocoVazio, MetaVazia } from './FocoParts.jsx';

// A tela nova da Meta (Foco agora, mockup B), atrás do ?meta=nova até a
// virada. A faixa do topo, a barra "Foco em", o bloco Agora com a tarefa da vez
// e a fila "Depois". A lateral vem pronta da Meta (`aside`), porque usa peças
// que moram na DailyGoalView. Quem grava são os handlers da Meta.
//
// O Agora fica parado: a tela guarda a chave da tarefa escolhida pela última
// ação (clicar numa linha da fila, pular, voltar à ordem, trocar de foco) e o
// relógio nunca a troca. Só quando a tarefa some da lista (concluída, remarcada,
// dado novo) vale a primeira da ordem (pickAgora, em metaFoco.js).
export function MetaFocoScreen({
  strip, processedLeads, now, sla, renewalCheckpoints, meId, foco, onFoco,
  totalSlots, doneSlots, volume, perfectDay, tomorrow, aside,
  onOutcome, onReschedule, onGoalDone, onWhatsapp, onCall,
}) {
  const opts = useMemo(() => ({ sla, renewalCheckpoints }), [sla, renewalCheckpoints]);
  const entries = useMemo(() => pendingEntries(processedLeads), [processedLeads]);
  const tabs = useMemo(() => focoTabs(entries, now, opts), [entries, now, opts]);
  const [skipped, setSkipped] = useState([]);
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

  // Escolher uma linha da fila leva o foco do teclado ao Agora, que rola para a vista.
  const agoraRef = useRef(null);
  const focusAgora = useRef(false);
  useEffect(() => {
    if (!focusAgora.current) return;
    focusAgora.current = false;
    agoraRef.current?.focus();
  });

  const pick = (e) => {
    focusAgora.current = true;
    setSel({ key: e.key, pinned: true, foco });
  };
  const skip = () => {
    if (!agora) return;
    setSkipped((s) => [...s.filter((k) => k !== agora.key), agora.key]);
    setSel({ key: null, pinned: false, foco });
  };
  const unpin = () => setSel({ key: null, pinned: false, foco });

  const fila = agora ? list.filter((e) => e.key !== agora.key) : [];
  const morning = doneSlots === 0 ? morningText(entries) : '';

  let body;
  if (totalSlots === 0) body = <MetaVazia />;
  else if (entries.length === 0) body = <DiaFechado doneSlots={doneSlots} volume={volume} perfectDay={perfectDay} tomorrow={tomorrow} />;
  else if (!agora) body = <FocoVazio label={FOCO_LABEL[foco]} onAll={() => onFoco('all')} />;
  else {
    body = (
      <>
        <AgoraCard
          ref={agoraRef}
          entry={agora}
          why={whyOf(agora, now, opts)}
          facts={factsOf(agora, now, opts)}
          now={now}
          meId={meId}
          pinned={pinned}
          onUnpin={unpin}
          onSkip={skip}
          onOutcome={onOutcome}
          onReschedule={onReschedule}
          onGoalDone={onGoalDone}
          onWhatsapp={onWhatsapp}
          onCall={onCall}
        />
        <FilaDepois items={fila} sla={sla} onPick={pick} whyOf={(e) => whyOf(e, now, opts)} />
      </>
    );
  }

  return (
    <div className="relative flex flex-col font-sans">
      <DiaStrip {...strip} />
      {morning && <p className="mt-3 px-1 text-[13.5px] text-muted-foreground">{morning}</p>}
      {/* O leitor de tela ouve a tarefa nova quando o Agora troca. */}
      <p className="sr-only" aria-live="polite">{agora ? `Agora: ${agora.lead.name || 'lead sem nome'}, ${CATEGORY_ONE[agora.slug]}` : ''}</p>
      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <FocoBar tabs={tabs} value={foco} onChange={onFoco}>
            <TabsContent value={foco}>{body}</TabsContent>
          </FocoBar>
        </div>
        <aside aria-label="Painel do dia" className="flex min-w-0 flex-col gap-3.5">{aside}</aside>
      </div>
    </div>
  );
}
