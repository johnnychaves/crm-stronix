// Coluna do autor na linha do tempo da ficha (a quarta, de 110px). Linha comum
// mostra só o nome. Agendamento feito pelo Stronizap leva a marca antes do nome
// e o detalhe ("Agendado pelo Stronizap, canal Recepção") em três lugares, um
// para cada jeito de ler:
// - title da célula: o mouse em cima da marca mostra o detalhe;
// - title do nome: o mouse em cima do nome mostra o nome inteiro, que a marca e
//   a coluna estreita podem cortar;
// - texto só para leitor de tela: o title não chega a leitor de tela nem ao
//   toque, e a marca é decorativa.
import { cn } from '@/lib/utils';
import { StronizapBadge } from '../brand/StronizapMark.jsx';

// A classe da coluna como ela era na ficha: a linha sem marca sai igual.
const COLUNA = 'text-[11px] text-slate-500 dark:text-slate-400 text-right truncate pt-0.5';

// `zapTitle` é o detalhe que zapScheduleTitle (lib/timeline.js) devolve, ou null
// quando a linha não é um agendamento do Stronizap. Quem decide é a ficha.
export function TimelineAuthor({ author, zapTitle = null }) {
  return (
    <div
      className={cn(COLUNA, zapTitle && 'flex items-center justify-end gap-[5px]')}
      title={zapTitle || author}
    >
      {zapTitle ? (
        <>
          <StronizapBadge />
          <span className="truncate" title={author}>{author}</span>
          <span className="sr-only">{zapTitle}</span>
        </>
      ) : author}
    </div>
  );
}
