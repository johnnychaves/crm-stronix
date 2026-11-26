import { Check, ChevronRight, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrefFor } from '../../lib/routes.js';
import { nivelTexto } from '../../lib/professor/metas.js';
import { AppLink } from '../../components/nav/AppLink.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { ESTADO_TEXTO } from './criterios.js';

// A lista de professores (mockup A, tabela de placar): uma linha por
// professor, e a linha inteira é o link do perfil. O nome do link diz tudo o
// que a linha mostra, porque o cabeçalho das colunas é só visual. A tabela
// quebra pela largura dela (@container), não pela da janela: com o menu ao
// lado, a coluna tem bem menos que a tela.
const COLUNAS = '@[880px]:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(104px,1fr))_20px]';
const CRITERIOS = [
  ['renovacao', 'Renovação'],
  ['nps', 'Nota dos alunos'],
  ['conversao', 'Conversão'],
  ['aderencia', 'Aderência'],
];

const MARCA = {
  ok: { Icon: Check, cls: 'bg-emerald-600 text-white dark:bg-emerald-500' },
  baixo: { Icon: X, cls: 'bg-rose-600 text-white dark:bg-rose-500' },
  sem: { Icon: Minus, cls: 'bg-muted text-muted-foreground' },
};
const NUMERO = {
  ok: 'text-foreground',
  baixo: 'text-rose-700 dark:text-rose-300',
  sem: 'text-muted-foreground',
};

export function MarcaDoEstado({ estado, className }) {
  const { Icon, cls } = MARCA[estado];
  return (
    <span aria-hidden="true" className={cn('grid size-4 flex-none place-items-center rounded-full', cls, className)}>
      <Icon size={10} strokeWidth={3.4} />
    </span>
  );
}

function rotuloDaLinha({ prof, criterios }) {
  const partes = CRITERIOS.map(([k, titulo]) => {
    const c = criterios[k];
    return c.valor == null
      ? `${titulo}, ${c.ref}`
      : `${titulo} ${c.valor}, ${c.ref}, ${c.estado === 'sem' ? 'sem referência' : ESTADO_TEXTO[c.estado]}`;
  });
  return `${prof.nome || 'Professor sem nome'}, ${nivelTexto(prof.nivel)}. ${partes.join('. ')}. Abrir perfil`;
}

function Celula({ titulo, criterio }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[12px] font-medium text-muted-foreground @[880px]:hidden">{titulo}</span>
      <span className="flex items-center gap-[7px]">
        <b className={cn('num font-display text-[22px] font-bold leading-none tracking-[-0.02em]', NUMERO[criterio.estado])}>
          {criterio.valor ?? '—'}
        </b>
        <MarcaDoEstado estado={criterio.estado} />
      </span>
      <small className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{criterio.ref}</small>
    </div>
  );
}

// `desde` (dd/mm/aaaa) entra no perfil: "Júnior desde 01/12/2026".
export function SeloDoNivel({ nivel, desde = null }) {
  const tem = nivelTexto(nivel) !== 'Sem nível';
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold',
        tem ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-muted text-muted-foreground',
      )}
    >
      {tem && <i className="size-[7px] rounded-full bg-brand-600" />}
      {nivelTexto(nivel)}
      {tem && desde && ` desde ${desde}`}
    </span>
  );
}

export function ProfessoresTabela({ linhas, tenantId }) {
  return (
    <div className="@container overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      <div
        aria-hidden="true"
        className={cn('hidden h-[46px] items-center gap-3.5 border-b border-border px-5 text-[12.5px] font-medium text-muted-foreground @[880px]:grid', COLUNAS)}
      >
        <span>Professor</span>
        {CRITERIOS.map(([k, titulo]) => <span key={k}>{titulo}</span>)}
        <span />
      </div>
      <ul className="m-0 list-none p-0">
        {linhas.map((linha) => (
          <li key={linha.prof.id} className="border-b border-border last:border-b-0">
            <AppLink
              to={hrefFor(tenantId, 'professorPerfil', { profId: linha.prof.id })}
              aria-label={rotuloDaLinha(linha)}
              className={cn(
                'group grid grid-cols-2 items-center gap-x-3.5 gap-y-3 px-4 py-3.5 outline-none transition-colors hover:bg-brand-50/50 focus-visible:anel-foco focus-visible:ring-inset dark:hover:bg-white/[0.03]',
                '@[560px]:grid-cols-4 @[880px]:min-h-[72px] @[880px]:px-5 @[880px]:py-2',
                COLUNAS,
              )}
            >
              <div className="col-span-2 flex min-w-0 items-center gap-3 @[560px]:col-span-4 @[880px]:col-span-1">
                <span aria-hidden="true"><Avatar name={linha.prof.nome} photoUrl={linha.prof.photoUrl || null} size={40} /></span>
                <div className="min-w-0">
                  <b className="block truncate font-semibold">{linha.prof.nome || 'Professor sem nome'}</b>
                  <span className="mt-[3px] block"><SeloDoNivel nivel={linha.prof.nivel} /></span>
                </div>
              </div>
              {CRITERIOS.map(([k, titulo]) => <Celula key={k} titulo={titulo} criterio={linha.criterios[k]} />)}
              <ChevronRight aria-hidden="true" size={18} className="hidden text-muted-foreground/60 group-hover:text-brand-700 @[880px]:block dark:group-hover:text-brand-300" />
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegendaDosEstados() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-[18px] gap-y-2 text-[12.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-[7px]"><MarcaDoEstado estado="ok" />Bateu a referência</span>
      <span className="inline-flex items-center gap-[7px]"><MarcaDoEstado estado="baixo" />Ficou abaixo</span>
      <span className="inline-flex items-center gap-[7px]"><MarcaDoEstado estado="sem" />Ainda sem dados no ciclo</span>
    </div>
  );
}
