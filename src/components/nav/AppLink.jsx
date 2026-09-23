import { Link } from 'react-router';
import { cn } from '../../lib/utils.js';
import { useLeadProfile } from '../../contexts/LeadProfileContext.jsx';

// A mesma regra do Link do React Router (shouldProcessLinkClick): só o clique
// esquerdo sem Ctrl, Cmd, Shift ou Alt, e sem mandar para outra janela, troca
// de tela nesta aba. O resto (aba nova, janela nova, botão do meio) fica com
// o navegador.
function opensHere(event, target) {
  return event.button === 0
    && (!target || target === '_self')
    && !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

// Link interno do app. É um <a href> de verdade, então Ctrl+clique, botão do
// meio e "Abrir em nova aba" funcionam. onNavigate roda só quando o clique
// troca de tela nesta aba (fechar o sino, a busca, o menu do celular): com
// Ctrl+clique a lista continua aberta para abrir outras fichas.
// stretched estica a área do link sobre o card inteiro. O card precisa de
// `relative`, e os botões de dentro dele, de `relative z-10`.
export function AppLink({ to, onNavigate, onClick, stretched = false, className, ref, ...rest }) {
  function handleClick(event) {
    onClick?.(event);
    if (onNavigate && !event.defaultPrevented && opensHere(event, rest.target)) onNavigate(event);
  }

  return (
    <Link
      {...rest}
      ref={ref}
      to={to}
      onClick={handleClick}
      className={cn(stretched && 'after:absolute after:inset-0', className) || undefined}
    />
  );
}

// Link para a ficha do lead ou cliente. O endereço e a tela de origem vêm do
// LeadProfileContext, e a origem vai no state da navegação (só o id da tela,
// nunca dado da pessoa). Id que não serve para endereço vira texto sem link,
// e fora do Provider também. Nesse texto sem link só sobrevivem className,
// title e os filhos: o title vai junto porque nome truncado sem tooltip fica
// ilegível (é o "Consultor: X" do rodapé do card do Pipeline). O resto das
// props é de âncora e não tem o que fazer num <span>.
export function LeadLink({ leadId, children, className, title, ...rest }) {
  const { leadHref, from } = useLeadProfile();
  const href = leadHref?.(leadId) ?? null;

  if (!href) return <span className={className} title={title}>{children}</span>;

  return (
    <AppLink {...rest} to={href} state={{ from: from ?? null }} className={className} title={title}>
      {children}
    </AppLink>
  );
}
