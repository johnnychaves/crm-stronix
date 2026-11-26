import { Clock, Info, Plus, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { NUMEROS, numerosDaBase } from '../../../lib/carreira/numeros.js';
import { MAX_NIVEIS } from '../../../lib/carreira/trilhas.js';
import {
  acrescentarNivel, apagarNivel, ligarNumero, metasEmBranco, motivoDoApagar, renomearNivel, trocarMeses, trocarMeta,
} from '../../../lib/carreira/rascunho.js';
import { BASE_UI, NUMERO_UI, pessoasTexto, unidadeDe } from './carreiraTexto.js';
import { CampoNumero } from './CampoNumero.jsx';

// A aba Níveis e metas (mockup A refinado): os níveis no topo, desenhados como
// degraus que crescem da esquerda para a direita, o tempo mínimo na primeira
// linha e um número por linha, com o liga e desliga e um campo por nível. A
// grade rola de lado quando não cabe. `pessoas` conta quem está em cada nível
// (pessoasPorNivel), `onMudar` recebe a função que muda o rascunho e `avisar`
// mostra o motivo de um botão desligado.
const COLUNA_NOME = 280;
const COLUNA_NIVEL = 156;
const COLUNA_FIM = 120;

function Linha({ colunas, className, children }) {
  return <div style={colunas} className={cn('grid border-b border-border', className)}>{children}</div>;
}

function Celula({ children }) {
  return <div className="flex items-center border-l border-border px-[18px] py-3.5">{children}</div>;
}

function NomeDaLinha({ chave, tile, icone: Icone, nome, legenda, apagado = false }) {
  return (
    <div className="flex items-center gap-3 px-[18px] py-3.5">
      {chave ?? <span aria-hidden="true" className="w-8 flex-none" />}
      <span aria-hidden="true" className={cn('grid size-9 flex-none place-items-center rounded-[11px]', tile)}>
        <Icone size={18} />
      </span>
      <span className="min-w-0">
        <b className={cn('block text-[14px] font-semibold leading-tight', apagado && 'text-muted-foreground')}>{nome}</b>
        <small className={cn('mt-px block text-[12px] text-muted-foreground', apagado && 'text-muted-foreground/70')}>{legenda}</small>
      </span>
    </div>
  );
}

export function TrilhaGrade({ trilha, pessoas, onMudar, onRegras, avisar }) {
  const N = trilha.niveis.length;
  const ui = BASE_UI[trilha.base];
  const colunas = {
    gridTemplateColumns: `minmax(${COLUNA_NOME}px,1.35fr) repeat(${N}, minmax(${COLUNA_NIVEL}px,1fr)) ${COLUNA_FIM}px`,
    minWidth: `${COLUNA_NOME + N * COLUNA_NIVEL + COLUNA_FIM}px`,
  };
  // De 0 (primeiro nível) a 2 (último): a altura e a força do degrau.
  const degrau = (i) => (N === 1 ? 2 : (i * 2) / (N - 1));
  const brancas = metasEmBranco(trilha);
  const cheio = N >= MAX_NIVEIS;
  const motivoDoCheio = `A trilha tem no máximo ${MAX_NIVEIS} níveis.`;

  return (
    <section aria-label="Níveis e metas" className="overflow-x-auto overscroll-x-contain rounded-[18px] border border-border bg-card shadow-card">
      <div style={colunas} className="grid border-b border-border bg-muted/40">
        <div className="flex flex-col justify-end gap-0.5 p-[18px]">
          <b className="font-display text-[14px] font-bold">Os níveis</b>
          <span className="text-[12.5px] text-muted-foreground">do primeiro ao último</span>
        </div>
        {trilha.niveis.map((nivel, i) => {
          const motivo = motivoDoApagar(trilha, nivel, pessoas);
          const n = Number(pessoas?.[nivel.id]) || 0;
          const nome = nivel.nome || `nível ${i + 1}`;
          return (
            <div key={nivel.id} className="flex flex-col gap-2 border-l border-border p-[18px] pb-4">
              <div aria-hidden="true" className="flex h-[72px] items-end">
                <span
                  className={cn('relative block w-full rounded-[10px_10px_4px_4px]', ui.degrau)}
                  style={{ height: 22 + degrau(i) * 22, opacity: 0.45 + degrau(i) * 0.25 }}
                >
                  <span className="absolute bottom-1.5 left-2.5 text-[11.5px] font-bold text-white">{i + 1}</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={nivel.nome}
                  onChange={(e) => onMudar((t) => renomearNivel(t, nivel.id, e.target.value))}
                  aria-label={`Nome do nível ${i + 1}`}
                  className="-mx-1.5 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-0.5 font-display text-[18px] font-bold tracking-tight outline-none hover:bg-card focus-visible:bg-card focus-visible:anel-foco"
                />
                <button
                  type="button"
                  aria-label={`Apagar o nível ${nome}`}
                  aria-disabled={motivo ? 'true' : undefined}
                  title={motivo ?? undefined}
                  onClick={() => (motivo ? avisar(motivo) : onMudar((t) => apagarNivel(t, nivel.id)))}
                  className="grid size-7 flex-none place-items-center rounded-lg text-muted-foreground outline-none hover:bg-rose-50 hover:text-rose-700 focus-visible:anel-foco aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 text-[12.5px]', n ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
                <Users size={14} aria-hidden="true" />
                {pessoasTexto(n)}
              </span>
            </div>
          );
        })}
        <div className="flex items-end justify-center border-l border-dashed border-border p-[18px]">
          <button
            type="button"
            aria-label="Acrescentar nível"
            aria-disabled={cheio ? 'true' : undefined}
            title={cheio ? motivoDoCheio : undefined}
            onClick={() => (cheio ? avisar(motivoDoCheio) : onMudar((t) => acrescentarNivel(t)))}
            className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border-[1.5px] border-dashed border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground outline-none hover:border-brand-200 hover:text-brand-700 focus-visible:anel-foco aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:hover:text-brand-300"
          >
            <Plus size={15} aria-hidden="true" />
            Nível
          </button>
        </div>
      </div>

      <Linha colunas={colunas} className="bg-muted/30">
        <NomeDaLinha tile={ui.tile} icone={Clock} nome="Tempo mínimo no nível" legenda="antes de poder subir" />
        {trilha.niveis.map((nivel, i) => (
          <Celula key={nivel.id}>
            {i < N - 1 ? (
              <CampoNumero
                valor={nivel.mesesMinimos}
                onValor={(v) => onMudar((t) => trocarMeses(t, nivel.id, v))}
                depois="meses"
                vazio=""
                rotulo={`Meses mínimos em ${nivel.nome || `nível ${i + 1}`} antes de subir`}
              />
            ) : (
              <span className="text-[13px] text-muted-foreground/70">último nível</span>
            )}
          </Celula>
        ))}
        <div className="border-l border-dashed border-border" />
      </Linha>

      {numerosDaBase(trilha.base).map((id) => {
        const numero = trilha.numeros[id];
        const nome = NUMEROS[id].nome;
        const un = unidadeDe(id, trilha.ajustes);
        const chave = (
          <Switch
            checked={numero.ligado}
            onCheckedChange={(v) => onMudar((t) => ligarNumero(t, id, v))}
            aria-label={`${nome} conta nesta trilha`}
            className="focus-visible:anel-foco focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        );
        return (
          <Linha key={id} colunas={colunas}>
            <NomeDaLinha
              chave={chave}
              tile={numero.ligado ? ui.tile : 'bg-muted text-muted-foreground/70'}
              icone={NUMERO_UI[id].icone}
              nome={nome}
              legenda={NUMERO_UI[id].legenda(trilha.ajustes)}
              apagado={!numero.ligado}
            />
            {numero.ligado ? (
              <>
                {trilha.niveis.map((nivel, i) => (
                  <Celula key={nivel.id}>
                    <CampoNumero
                      valor={numero.metas[nivel.id] ?? null}
                      onValor={(v) => onMudar((t) => trocarMeta(t, id, nivel.id, v))}
                      antes={un.antes}
                      depois={un.depois}
                      escala={un.escala}
                      rotulo={`${nome}, ${nivel.nome || `nível ${i + 1}`}`}
                    />
                  </Celula>
                ))}
                <div className="border-l border-dashed border-border" />
              </>
            ) : (
              <div style={{ gridColumn: '2 / -1' }} className="flex items-center border-l border-border bg-muted/40 px-[18px] text-[13px] text-muted-foreground">
                Não conta nesta trilha
              </div>
            )}
          </Linha>
        );
      })}

      <p className="flex items-center gap-2 bg-muted/30 px-[18px] py-3 text-[12.5px] text-muted-foreground">
        <Info size={15} aria-hidden="true" className="flex-none" />
        <span>
          {brancas > 0 && 'Meta em branco: o número aparece no placar sem dizer se bateu. '}
          Como cada número é contado está em{' '}
          <button type="button" onClick={onRegras} className="rounded font-semibold text-brand-700 underline-offset-2 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300">
            Regras da trilha
          </button>
          .
        </span>
      </p>
    </section>
  );
}
