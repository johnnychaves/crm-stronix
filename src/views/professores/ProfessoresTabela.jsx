import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrefFor } from '../../lib/routes.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { valorTexto } from './criterios.js';

// A lista Carreira (mockup "Lista Carreira", 26/11/2026): uma linha por
// pessoa, e a linha inteira é o link do perfil. O nome do link diz tudo o que
// a linha mostra, porque o cabeçalho das colunas é só visual. A tabela quebra
// pela largura dela (@container), não pela da janela.
const COLUNAS = '@[880px]:grid-cols-[minmax(220px,1.4fr)_minmax(150px,0.9fr)_minmax(170px,1fr)_minmax(200px,1.2fr)_20px]';

// O quadradinho de cada número na linha: verde na meta, vermelho abaixo, cinza
// sem dados, tracejado sem meta.
const QUADRADO = {
  ok: 'bg-emerald-500',
  baixo: 'bg-rose-500',
  sem: 'bg-slate-300 dark:bg-white/20',
  semMeta: 'border border-dashed border-muted-foreground/70',
};

// `nome` é o nome do nível na trilha (null é "Sem nível"); `desde` (dd/mm/aaaa)
// entra no perfil: "Júnior desde 01/12/2026".
export function SeloDoNivel({ nome, desde = null }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold',
        nome ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-muted text-muted-foreground',
      )}
    >
      {nome && <i className="size-[7px] rounded-full bg-brand-600" />}
      {nome ?? 'Sem nível'}
      {nome && desde && ` desde ${desde}`}
    </span>
  );
}

const resumoDasMetas = ({ placar }) => {
  if (!placar.nivel) return 'Sem nível';
  if (!placar.comMeta) return 'Sem metas definidas';
  return `${placar.naMeta} de ${placar.comMeta} na meta do ${placar.nivel.nome}`;
};

function rotuloDaLinha(linha) {
  const { prof, trilha, placar, tempo } = linha;
  const numeros = placar.itens.map((i) => `${i.nome} ${valorTexto(i.id, i.valor, { vendasEm: trilha?.ajustes?.vendasEm }) ?? 'sem dados'}`).join(', ');
  return [
    prof.nome || 'Professor sem nome',
    trilha ? `trilha ${trilha.nome}` : 'sem trilha',
    placar.nivel ? placar.nivel.nome : 'sem nível',
    tempo ? (tempo.falta ?? tempo.texto) : null,
    resumoDasMetas(linha),
    numeros,
    'Abrir perfil',
  ].filter(Boolean).join('. ');
}

export function ProfessoresTabela({ linhas, tenantId }) {
  return (
    <div className="@container overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      <div aria-hidden="true" className={cn('hidden h-[46px] items-center gap-3.5 border-b border-border px-5 text-[12.5px] font-medium text-muted-foreground @[880px]:grid', COLUNAS)}>
        <span>Pessoa</span>
        <span>Nível</span>
        <span>Tempo no nível</span>
        <span>Números do período</span>
        <span />
      </div>
      <ul className="m-0 list-none p-0">
        {linhas.map((linha) => {
          const { prof, trilha, placar, tempo, desde } = linha;
          return (
            <li key={prof.id} className="border-b border-border last:border-b-0">
              <AppLink
                to={hrefFor(tenantId, 'professorPerfil', { profId: prof.id })}
                aria-label={rotuloDaLinha(linha)}
                className={cn(
                  'group grid grid-cols-1 items-center gap-x-3.5 gap-y-3 px-4 py-3.5 outline-none transition-colors hover:bg-brand-50/50 focus-visible:anel-foco focus-visible:ring-inset dark:hover:bg-white/[0.03]',
                  '@[560px]:grid-cols-2 @[880px]:min-h-[72px] @[880px]:px-5 @[880px]:py-2',
                  COLUNAS,
                )}
              >
                <div className="flex min-w-0 items-center gap-3 @[560px]:col-span-2 @[880px]:col-span-1">
                  <span aria-hidden="true"><Avatar name={prof.nome} photoUrl={prof.photoUrl || null} size={40} /></span>
                  <div className="min-w-0">
                    <b className="block truncate font-semibold">{prof.nome || 'Professor sem nome'}</b>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{trilha ? trilha.nome : 'Sem trilha'}</span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <SeloDoNivel nome={placar.nivel?.nome ?? null} />
                  {desde && <small className="text-[12px] text-muted-foreground">desde {desde}</small>}
                  {!trilha && <small className="text-[12px] font-semibold text-brand-700 dark:text-brand-300">Definir trilha e nível</small>}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  {tempo ? (
                    <>
                      {tempo.pct != null && (
                        <span aria-hidden="true" className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-muted">
                          <i className={cn('block h-full rounded-full', tempo.pct >= 100 ? 'bg-emerald-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, tempo.pct)}%` }} />
                        </span>
                      )}
                      <small className="text-[12.5px] text-foreground/80">{tempo.texto}</small>
                      {tempo.falta && <small className="text-[12px] text-muted-foreground">{tempo.falta}</small>}
                    </>
                  ) : (
                    <small className="text-[12.5px] text-muted-foreground">Sem data do nível</small>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span aria-hidden="true" className="flex gap-1">
                    {placar.itens.map((i) => <i key={i.id} className={cn('block size-3.5 rounded-[4px]', QUADRADO[i.estado])} />)}
                  </span>
                  <small className="text-[12.5px] text-foreground/80">{resumoDasMetas(linha)}</small>
                </div>
                <ChevronRight aria-hidden="true" size={18} className="hidden text-muted-foreground/60 group-hover:text-brand-700 @[880px]:block dark:group-hover:text-brand-300" />
              </AppLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LegendaDosEstados() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-[18px] gap-y-2 text-[12.5px] text-muted-foreground">
      {[['ok', 'Na meta'], ['baixo', 'Abaixo da meta'], ['sem', 'Sem dados no período'], ['semMeta', 'Sem meta definida']].map(([k, t]) => (
        <span key={k} className="inline-flex items-center gap-[7px]"><i aria-hidden="true" className={cn('block size-3.5 rounded-[4px]', QUADRADO[k])} />{t}</span>
      ))}
    </div>
  );
}
