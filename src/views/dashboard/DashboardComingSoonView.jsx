// Abas CRM e Gerencial da Visão geral, por enquanto só com o aviso "Em breve".
// O CRM vai reunir lead e funil; o Gerencial volta com um papel novo. A tela
// antiga do Gerencial (DashboardGerencialView) saiu do menu e fica no código
// como base para os dois. Mesmo cabeçalho do Operacional, que anula o padding
// do App, e o cartão tracejado que o Operacional usa para "não disponível".
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';

const PAGES = {
  crm: {
    title: 'CRM',
    subline: 'Leads, funil e conversão, mês a mês.',
    note: 'Enquanto isso, a rotina, a base de clientes e a renovação estão no Operacional.'
  },
  gerencial: {
    title: 'Gerencial',
    subline: 'A tela está sendo refeita e volta com um papel novo.',
    note: 'Lead e funil vão para o CRM. A rotina, a base de clientes e a renovação já estão no Operacional.'
  }
};

export function DashboardComingSoonView({ page, onNavigate }) {
  const p = PAGES[page] || PAGES.crm;
  return (
    <div className="-m-4 md:-m-8 font-sans">
      <header className="bg-card px-4 md:px-8 pb-4 pt-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-[-0.02em]">{p.title}</h2>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            Em breve
          </span>
        </div>
        <p className="mt-[5px] max-w-[820px] text-[12.5px] leading-normal text-muted-foreground">{p.subline}</p>
      </header>
      <div className="border-t border-border px-4 md:px-8 pb-8 pt-5">
        <div className="flex max-w-[620px] flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-slate-50 p-[18px] dark:bg-white/[0.03]">
          <p className="m-0 text-[13px] leading-normal text-muted-foreground">{p.note}</p>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('dashOperacional')}>
            Abrir o Operacional
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
