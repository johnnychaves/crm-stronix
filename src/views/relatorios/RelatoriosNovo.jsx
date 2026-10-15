// Balão "Novo" do item Relatórios do menu, no molde do das Rotinas: o clique
// abre um aviso curto do que a tela faz (decisão do Johnny, 15/10/2026).
import { NewFeatureBadge } from '../../components/NewFeatureBadge.jsx';

// Até quando o balão aparece: uns 30 dias depois do lançamento. Depois disso o
// App passa null e o item volta a ser o link de sempre.
export const NOVO_ATE = '2026-11-15';

export function RelatoriosNovo(props) {
  return (
    <NewFeatureBadge
      {...props}
      until={NOVO_ATE}
      title="Relatórios"
      description="Escolha o período, o consultor, a origem e o funil, e veja os números dos leads em cinco relatórios."
    >
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
        <li><span className="font-semibold text-foreground">Entrada de leads:</span> quantos chegaram, de onde e para qual consultor.</li>
        <li><span className="font-semibold text-foreground">Conversão:</span> dos que chegaram, quantos agendaram, vieram e matricularam.</li>
        <li><span className="font-semibold text-foreground">Visitas e aulas:</span> quantas visitas e aulas experimentais, quem veio e quem faltou.</li>
        <li><span className="font-semibold text-foreground">Perdas:</span> por qual motivo e em que etapa os leads se perderam.</li>
        <li><span className="font-semibold text-foreground">Leads parados:</span> quem está sem próximo passo, com contato atrasado ou sem registro.</li>
        <li>Clique num número para ver os nomes e exportar a lista.</li>
      </ul>
    </NewFeatureBadge>
  );
}
