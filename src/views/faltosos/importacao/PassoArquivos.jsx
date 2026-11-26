import { useRef, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../../../components/ui/button.jsx';
import { ddmmaaaa } from '../../../lib/faltosos/dias.js';
import { resumoDoArquivo } from '../../../lib/faltosos/passosImportacao.js';

// Passo 1 da importação: um ou os dois relatórios da Next Fit, em qualquer
// ordem. Cada arquivo é reconhecido pelo cabeçalho (classificarArquivo), e o
// arquivo novo de um tipo troca o anterior do mesmo tipo.

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function CartaoDoArquivo({ titulo, arquivo, onTirar, travado }) {
  if (!arquivo) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] text-muted-foreground">
        <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0" />
        <span>{titulo}: nenhum arquivo</span>
      </div>
    );
  }
  return (
    <div data-arquivo={arquivo.tipo} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{titulo}</div>
          <div className="truncate text-[12px] text-muted-foreground">{arquivo.nome} · {resumoDoArquivo(arquivo)}</div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onTirar} disabled={travado} aria-label={`Tirar o ${titulo}`}>
          <X />
        </Button>
      </div>
      {arquivo.divergentes > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          Em {plural(arquivo.divergentes, 'linha', 'linhas')} a data não bate com as outras. Valeu {ddmmaaaa(arquivo.dia)}.
        </p>
      )}
      {arquivo.erros?.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          {plural(arquivo.erros.length, 'linha não deu', 'linhas não deram')} para ler e {arquivo.erros.length === 1 ? 'fica' : 'ficam'} de fora.
        </p>
      )}
    </div>
  );
}

export function PassoArquivos({ arquivos, recusas, problemas, lembrete, lendo, travado = false, onArquivos, onTirar }) {
  const inputRef = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const parado = lendo || travado;

  const receber = (lista) => {
    const files = [...(lista || [])];
    if (files.length) onArquivos(files);
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={parado}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!parado) receber(e.dataTransfer?.files); }}
        className={cn(
          'w-full rounded-2xl border border-dashed border-border p-7 text-center outline-none transition hover:border-primary hover:bg-primary/5 focus-visible:anel-foco disabled:opacity-50',
          arrastando && 'border-primary bg-primary/5',
        )}
      >
        {lendo
          ? <Loader2 aria-hidden="true" className="mx-auto size-[22px] animate-spin text-primary" />
          : <Upload aria-hidden="true" className="mx-auto size-[22px] text-primary" />}
        <span className="mt-2 block text-[13.5px] font-semibold">{lendo ? 'Lendo as planilhas…' : 'Escolher arquivos'}</span>
        <span className="mt-1 block text-[12px] text-muted-foreground">Solte aqui o Faltantes, o Presenças ou os dois, em qualquer ordem.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-label="Planilhas da Next Fit"
        onChange={(e) => {
          // Copia antes de limpar: limpar o campo deixa escolher o mesmo
          // arquivo de novo.
          const files = [...(e.target.files || [])];
          e.target.value = '';
          receber(files);
        }}
      />

      <div className="rounded-xl bg-muted px-4 py-3 text-[12px] text-muted-foreground">
        <p className="font-semibold text-foreground">Como exportar da Next Fit</p>
        <p>{lembrete.faltantes}</p>
        <p>{lembrete.presencas}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <CartaoDoArquivo titulo="Faltantes" arquivo={arquivos.faltantes} onTirar={() => onTirar('faltantes')} travado={parado} />
        <CartaoDoArquivo titulo="Presenças" arquivo={arquivos.presencas} onTirar={() => onTirar('presencas')} travado={parado} />
      </div>

      {(recusas.length > 0 || problemas.length > 0) && (
        <div role="alert">
          <ul className="flex flex-col gap-1.5">
            {recusas.map((r, i) => (
              <li key={`recusa-${i}`} className="flex items-start gap-2 text-[12.5px] text-destructive">
                <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span><span className="font-semibold">{r.nome}:</span> {r.motivo}</span>
              </li>
            ))}
            {problemas.map((p, i) => (
              <li key={`problema-${i}`} className="flex items-start gap-2 text-[12.5px] text-destructive">
                <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
