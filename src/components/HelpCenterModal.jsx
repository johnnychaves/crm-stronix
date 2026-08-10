import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, GraduationCap, Lightbulb, Search, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { WIKI_ARTICLES, WIKI_CATEGORIES, searchWiki, getWikiArticle } from '../lib/wiki.js';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog.jsx';
import { WikiDemo } from './help/WikiDemo.jsx';

// CENTRAL DE AJUDA — a wiki do Stronilead. Master-detail: índice por categoria
// à esquerda, artigo à direita, busca no topo. Abre pelo 🎓 do header e também
// por um artigo específico (o sino manda o leitor direto para o assunto da
// novidade). Conteúdo em lib/wiki.js.

function Block({ block }) {
  switch (block.t) {
    case 'h':
      return (
        <h4 className="font-display text-[15px] font-bold tracking-tight mt-6 mb-2 pb-1.5 border-b border-slate-100 dark:border-white/[0.06] first:mt-0">
          {block.text}
        </h4>
      );

    case 'p':
      return <p className="text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300 mb-3">{block.text}</p>;

    case 'steps':
      return (
        <ol className="flex flex-col gap-2 mb-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="num size-5 rounded-md bg-brand-600 text-white text-[10.5px] font-bold grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
              <span className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{item}</span>
            </li>
          ))}
        </ol>
      );

    case 'tip':
      return (
        <div className="flex gap-2.5 rounded-xl border border-accent-200 dark:border-accent-500/25 bg-accent-50/70 dark:bg-accent-500/[0.07] border-l-[3px] border-l-accent-500 px-3.5 py-3 mb-4">
          <Lightbulb size={15} className="text-accent-600 dark:text-accent-400 shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">{block.text}</p>
        </div>
      );

    case 'warn':
      return (
        <div className="flex gap-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] border-l-[3px] border-l-slate-400 px-3.5 py-3 mb-4">
          <TriangleAlert size={15} className="text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">{block.text}</p>
        </div>
      );

    case 'demo':
      return <WikiDemo name={block.name} caption={block.caption} />;

    case 'media':
      return (
        <figure className="my-3">
          <img
            src={block.src}
            alt={block.alt || ''}
            loading="lazy"
            className="w-full rounded-xl border border-slate-200 dark:border-white/[0.08]"
          />
          {block.caption && (
            <figcaption className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 text-center">{block.caption}</figcaption>
          )}
        </figure>
      );

    default:
      return null;
  }
}

export function HelpCenterModal({ open, onClose, initialArticleId = null }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialArticleId || WIKI_ARTICLES[0]?.id || null);

  // Abrir num artigo específico (o sino manda o id da novidade).
  useEffect(() => {
    if (open && initialArticleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- o artigo alvo chega por prop no momento da abertura; só reage a isso.
      setSelectedId(initialArticleId);
      setQuery('');
    }
  }, [open, initialArticleId]);

  const results = useMemo(() => searchWiki(query), [query]);
  const article = getWikiArticle(selectedId) || results[0] || null;

  const grupos = WIKI_CATEGORIES
    .map((c) => ({ ...c, artigos: results.filter((a) => a.category === c.id) }))
    .filter((g) => g.artigos.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Tela cheia: a wiki é para ler, então ocupa tudo. max-w-none derruba o
          teto do Dialog padrão; o artigo mantém largura de leitura por dentro. */}
      <DialogContent className="p-0 gap-0 overflow-hidden w-screen h-[100dvh] max-w-none sm:max-w-none rounded-none border-0 flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <span className="size-9 rounded-xl bg-accent-50 dark:bg-accent-500/12 text-accent-600 dark:text-accent-400 grid place-items-center shrink-0">
            <GraduationCap size={18} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-[16px] font-bold tracking-tight leading-none">Central de ajuda</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground mt-1">
              Como o Stronilead funciona, do lead à renovação
            </DialogDescription>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid sm:grid-cols-[280px_minmax(0,1fr)]">
          {/* Índice */}
          <aside className={cn(
            'border-r border-border bg-slate-50/60 dark:bg-white/[0.02] py-3 overflow-y-auto custom-scrollbar',
            article && 'hidden sm:block'
          )}>
            <div className="px-3 mb-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar na ajuda"
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg text-[12.5px] bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
                />
              </div>
            </div>

            {grupos.length === 0 && (
              <p className="px-4 py-6 text-[12px] text-muted-foreground text-center">Nada encontrado para “{query}”.</p>
            )}

            {grupos.map((g) => (
              <div key={g.id}>
                <div className="px-4 pt-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[.1em] text-slate-400 dark:text-slate-500">{g.label}</div>
                {g.artigos.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      'w-full text-left px-4 py-1.5 text-[12.5px] border-l-2 transition',
                      a.id === article?.id
                        ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/12 dark:text-brand-300'
                        : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.04]'
                    )}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Artigo — a coluna ocupa a tela, o texto respeita a medida de leitura */}
          <div className="min-w-0 overflow-y-auto custom-scrollbar px-5 sm:px-10 py-6 sm:py-9">
            <div className="mx-auto w-full max-w-[780px]">
            {article ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 dark:text-brand-300 mb-3"
                >
                  <ArrowLeft size={13} /> Todos os artigos
                </button>
                <span className="inline-block text-[9.5px] font-bold uppercase tracking-[.1em] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                  {WIKI_CATEGORIES.find((c) => c.id === article.category)?.label}
                </span>
                <h3 className="font-display text-[20px] font-bold tracking-tight mt-2.5 mb-1.5">{article.title}</h3>
                <p className="text-[13px] text-muted-foreground mb-4">{article.summary}</p>
                {article.blocks.map((b, i) => <Block key={i} block={b} />)}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Escolha um artigo no índice.</p>
            )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
