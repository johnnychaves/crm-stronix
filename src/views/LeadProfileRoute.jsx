// Ficha por endereço: /<academia>/ficha/<id>. Só existe dentro do app logado,
// então nada da ficha sobrevive ao Sair. O App monta com key pelo id do
// endereço: pular de uma ficha para outra começa do zero (leitura e exclusão).
//
// O documento começa a ser lido na hora, mas a ficha só aparece com os
// catálogos da academia prontos (dataReady). Até lá fica o ProfileSkeleton.
// "Não encontrada", "excluída" e erro aparecem sem esperar a carga.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, House, LoaderCircle, RefreshCw, SearchX, Trash2, WifiOff } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import { ProfileSkeleton } from '../components/ui/Skeleton.jsx';
import { useProfileLead } from '../hooks/useProfileLead.js';
import { resolveFichaView } from '../lib/fichaState.js';
import { backTarget, hrefFor } from '../lib/routes.js';
import { isClientLead } from '../lib/leads.js';
import { cn } from '../lib/utils.js';
import { LeadProfileView } from './LeadProfileView.jsx';

// Moldura dos avisos: ícone, título, texto e botões, centralizados na área da
// tela. Mesmo desenho do "Essa tela travou" (ErrorBoundary.jsx).
function PanelShell({ icon, tone = 'muted', title, text, busy = false, children }) {
  return (
    <div role={busy ? 'status' : undefined} className="grid place-items-center h-full py-24 px-6">
      <div className="w-full max-w-[420px] text-center">
        <span
          className={cn(
            'inline-grid place-items-center size-12 rounded-2xl mb-4',
            tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
          )}
        >
          {icon}
        </span>
        <h2 className="font-display text-[20px] font-semibold tracking-tight text-foreground">{title}</h2>
        {text && <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{text}</p>}
        {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

// Aviso no lugar da ficha. view vem do resolveFichaView: 'deleting', 'deleted',
// 'error' ou 'missing' (que já inclui o id inválido do endereço).
export function FichaPanel({ view, onBack, onHome, onRetry }) {
  if (view === 'deleting') {
    return <PanelShell busy icon={<LoaderCircle className="size-6 animate-spin" />} title="Excluindo a ficha…" />;
  }
  if (view === 'deleted') {
    return (
      <PanelShell
        icon={<Trash2 className="size-6" />}
        title="Essa ficha foi excluída"
        text="Alguém da equipe excluiu esse cadastro enquanto ele estava aberto."
      >
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft /> Voltar</Button>
        <Button type="button" onClick={onHome}><House /> Ir para o início</Button>
      </PanelShell>
    );
  }
  if (view === 'error') {
    return (
      <PanelShell
        icon={<WifiOff className="size-6" />}
        tone="destructive"
        title="Não deu para abrir a ficha"
        text="Pode ser a internet. Tente de novo em alguns segundos."
      >
        <Button type="button" onClick={onRetry}><RefreshCw /> Tentar de novo</Button>
        <Button type="button" variant="outline" onClick={onHome}><House /> Ir para o início</Button>
      </PanelShell>
    );
  }
  return (
    <PanelShell
      icon={<SearchX className="size-6" />}
      title="Ficha não encontrada"
      text="Essa pessoa pode ter sido excluída, ou o link é de outra academia."
    >
      <Button type="button" onClick={onHome}><House /> Ir para o início</Button>
    </PanelShell>
  );
}

export function LeadProfileRoute({
  leadId, tab, onTab, tenantId, sessionKey, dataReady, listenersActive,
  db, appUser, statuses, tags, lossReasons, usersList, funnels,
}) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const { status, lead, retry } = useProfileLead({ db, leadId, sessionKey, active: listenersActive });
  const view = resolveFichaView({ status, dataReady, deleting });

  // A exclusão termina depois de vários await. Se a pessoa já saiu da ficha
  // nesse meio tempo, o Voltar do fim da exclusão não pode mexer no histórico
  // da tela em que ela está agora.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Voltar: o histórico é lido na hora do clique, nunca no render. Com uma tela
  // do app antes desta, é o voltar do navegador. Aberta direto numa aba nova,
  // troca a ficha pela lista (Clientes para cliente, Pipeline para lead).
  const goBack = () => {
    if (!mountedRef.current) return;
    const target = backTarget({ historyState: window.history.state, isClient: isClientLead(lead), tenantId });
    if (target.type === 'back') navigate(-1);
    else if (target.href) navigate(target.href, { replace: true });
  };
  const goHome = () => {
    const href = hrefFor(tenantId, 'dashboard');
    if (href) navigate(href, { replace: true });
  };

  if (view === 'loading') return <ProfileSkeleton />;
  if (view !== 'ready') return <FichaPanel view={view} onBack={goBack} onHome={goHome} onRetry={retry} />;
  return (
    <LeadProfileView
      key={lead.id}
      lead={lead}
      tab={tab}
      onTab={onTab}
      onBack={goBack}
      onDeleteStart={() => setDeleting(true)}
      onDeleteFailed={() => setDeleting(false)}
      listenersActive={listenersActive}
      appUser={appUser}
      statuses={statuses}
      tags={tags}
      lossReasons={lossReasons}
      usersList={usersList}
      db={db}
      funnels={funnels}
    />
  );
}
