import { cn } from '@/lib/utils';
import { LeadLink } from '../../components/nav/AppLink.jsx';
import { reaisTexto } from './criterios.js';

// As quatro abas do perfil do consultor (plano de carreira, PR 4). Cada nome
// abre a ficha (LeadLink). As contas vêm prontas de src/lib/carreiraConsultor.js.
// As linhas seguem a CarteiraTab: no estreito, o nome e a pílula em cima e o
// resto embaixo; a partir de 760px do cartão, uma coluna para cada dado.
const TIPO = { nova: 'Matrícula', renovacao: 'Renovação', upgrade: 'Upgrade', retorno: 'Retorno' };
const dia = (d) => (d instanceof Date ? d.toLocaleDateString('pt-BR') : '—');
const NOME = 'truncate font-semibold outline-none hover:text-brand-700 hover:underline focus-visible:anel-foco dark:hover:text-brand-300';
const CARTAO = '@container overflow-hidden rounded-[18px] border border-border bg-card shadow-card';
const LINHA = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3.5 text-[13.5px] last:border-b-0 @[760px]:min-h-[52px] @[760px]:gap-4 @[760px]:px-[22px] @[760px]:py-2';
// Na linha estreita, o que não é nome nem pílula desce para a segunda linha.
const EMBAIXO = 'order-3 text-[13px] text-muted-foreground @[760px]:order-none @[760px]:text-[13.5px]';
const PILULA_POS = 'order-2 justify-self-end @[760px]:order-none @[760px]:justify-self-start';

function Vazio({ children }) {
  return <p className="rounded-2xl border border-dashed border-border p-6 text-[13px] text-muted-foreground">{children}</p>;
}

function Pilula({ ok, children }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold', ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
      {children}
    </span>
  );
}

export function VendasTab({ vendas }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-10 gap-y-2 rounded-[18px] border border-border bg-card px-5 py-4 shadow-card">
        <div>
          <b className="num block text-[18px] font-bold">{vendas.quantidade} {vendas.quantidade === 1 ? 'venda' : 'vendas'}</b>
          <span className="text-[12.5px] text-muted-foreground">
            {vendas.matriculas} {vendas.matriculas === 1 ? 'matrícula' : 'matrículas'} e {vendas.renovacoes} {vendas.renovacoes === 1 ? 'renovação' : 'renovações'}
          </span>
        </div>
        <div>
          <b className="num block text-[18px] font-bold">{reaisTexto(vendas.total)}</b>
          <span className="text-[12.5px] text-muted-foreground">valor dos contratos, não o que entrou no caixa</span>
        </div>
      </div>
      {vendas.linhas.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : (
        <div className={CARTAO}>
          <ul aria-label="Vendas do período" className="m-0 list-none p-0">
            {vendas.linhas.map(({ contrato, quando, tipo, valor }) => (
              <li key={contrato.id} className={cn(LINHA, '@[760px]:grid-cols-[96px_minmax(0,1.4fr)_120px_minmax(0,1fr)_110px]')}>
                <span className={cn(EMBAIXO, 'num')}>{dia(quando)}</span>
                <LeadLink leadId={contrato.leadId} className={NOME}>{contrato.leadName || 'Cliente sem nome'}</LeadLink>
                <span className={PILULA_POS}><Pilula ok={tipo !== 'renovacao'}>{TIPO[tipo] ?? 'Matrícula'}</Pilula></span>
                <span className={cn(EMBAIXO, 'truncate')}>{contrato.planName || 'Sem plano'}</span>
                <span className="num order-4 text-right font-semibold @[760px]:order-none">{reaisTexto(valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const DESFECHO_RENOVACAO = { renew: 'Renovou', wont: 'Não vai renovar', lapsed: 'Não renovou', pending: 'Na tolerância' };

export function RenovacaoTab({ renovacao }) {
  if (!renovacao.linhas.length) return <Vazio>Nenhum contrato da carteira venceu no período.</Vazio>;
  return (
    <div className={CARTAO}>
      <ul aria-label="Contratos que venceram no período" className="m-0 list-none p-0">
        {renovacao.linhas.map(({ contract, outcome }) => (
          <li key={contract.id} className={cn(LINHA, '@[760px]:grid-cols-[96px_minmax(0,1.4fr)_minmax(0,1fr)_140px]')}>
            <span className={cn(EMBAIXO, 'num')}>Venceu em {dia(contract.plannedEndsAt)}</span>
            <LeadLink leadId={contract.leadId} className={NOME}>{contract.leadName || 'Cliente sem nome'}</LeadLink>
            <span className={cn(EMBAIXO, 'truncate')}>{contract.planName || 'Sem plano'}</span>
            <span className={PILULA_POS}><Pilula ok={outcome === 'renew'}>{DESFECHO_RENOVACAO[outcome]}</Pilula></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DESFECHO_LEAD = { enrolled: 'Matriculou', lost: 'Perdido', open: 'Em aberto' };

export function ConversaoTab({ conversao }) {
  return (
    <div className="flex flex-col gap-3">
      {conversao.incompleto && <p role="alert" className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">Algum mês do período não carregou. Recarregue a página.</p>}
      {conversao.linhas.length === 0 ? <Vazio>Nenhum lead cadastrado no período.</Vazio> : (
        <div className={CARTAO}>
          <ul aria-label="Leads do período" className="m-0 list-none p-0">
            {conversao.linhas.map(({ lead, desfecho }) => (
              <li key={lead.id} className={cn(LINHA, '@[760px]:grid-cols-[96px_minmax(0,1.4fr)_minmax(0,1fr)_120px]')}>
                <span className={cn(EMBAIXO, 'num')}>{dia(lead.createdAt)}</span>
                <LeadLink leadId={lead.id} className={NOME}>{lead.name || 'Lead sem nome'}</LeadLink>
                <span className={cn(EMBAIXO, 'truncate')}>{String(lead.source || '').trim() || 'Sem origem'}</span>
                <span className={PILULA_POS}><Pilula ok={desfecho === 'enrolled'}>{DESFECHO_LEAD[desfecho]}</Pilula></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MetaDiariaTab({ metaDiaria }) {
  if (!metaDiaria.dias.length) return <Vazio>Nenhum dia de meta no período ainda.</Vazio>;
  return (
    <div className={CARTAO}>
      <ul aria-label="Dias de meta do período" className="m-0 list-none p-0">
        {metaDiaria.dias.map((d) => (
          <li key={d.key} className={LINHA}>
            <span className="num capitalize">{d.inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>
            <span className="justify-self-end"><Pilula ok={d.bateu}>{d.bateu ? 'Bateu' : 'Não bateu'}</Pilula></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
