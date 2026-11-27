import { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../../../components/ui/button.jsx';
import { ContactPhone } from '../../../components/profile/ContactPhone.jsx';
import { getTone } from '../../../lib/leadState.js';
import { searchPeople } from '../../../lib/globalSearch.js';
import {
  MOTIVO_FORA, alunosParaLigar, cartoesDaPrevia, datasDaPrevia, linhaDasPresencas, linhasDeFora,
  textoDoAviso, voltasDaPrevia,
} from '../../../lib/faltosos/passosImportacao.js';

// Passo 3 da importação: a prévia do que o Confirmar vai gravar. Nada foi
// gravado ainda. Os números e as listas vêm prontos do plano (`previa` e
// `avisos`); a ligação à mão de um aluno refaz o plano na hora, sem ler nada,
// porque os clientes já estão na memória.

const CAMPO = 'h-9 w-full rounded-[10px] border border-border bg-card pl-8 pr-3 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30';

function Numero({ rotulo, valor, tom = 'slate', detalhe = '' }) {
  const n = Number.isFinite(valor) ? valor : 0;
  const t = getTone(tom);
  const realce = n > 0 && tom !== 'slate';
  return (
    <div className={cn('rounded-xl border border-border px-3 py-2.5', realce ? cn(t.soft, t.darkSoft) : 'bg-card')}>
      <div className={cn('num font-display text-[20px] font-bold leading-none', realce ? cn(t.text, t.darkText) : n > 0 ? 'text-foreground' : 'text-muted-foreground')}>{n}</div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{rotulo}</div>
      {detalhe && <div className="truncate text-[10.5px] text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

function Secao({ titulo, dica, children }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[13px] font-bold">{titulo}</h3>
        {dica && <p className="text-[11.5px] text-muted-foreground">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

// Um aluno que a importação não ligou: o nome (e o telefone, no Faltantes), o
// cliente provável de um nome já guardado, os clientes que empataram e a busca
// nos clientes da academia, que já estão na memória.
function LigarAluno({ item, clientes, porId, onLigar }) {
  const [busca, setBusca] = useState('');
  const resultados = useMemo(
    () => searchPeople(clientes, busca, { limit: 5 }).results.map((r) => r.lead),
    [clientes, busca],
  );
  const provavel = item.sugestao ? porId.get(item.sugestao) : null;
  return (
    <li data-nao-ligado={item.chave} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[13px] font-semibold">{item.nome}</span>
        {item.telefone && <span className="num text-[12px] text-muted-foreground">{item.telefone}</span>}
        <span className="text-[11px] text-muted-foreground">
          {item.origem === 'presencas' ? `Presenças, ${item.linhas === 1 ? '1 linha' : `${item.linhas} linhas`}` : 'Faltantes'}
        </span>
      </div>
      {(provavel || item.candidatos.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {provavel && <span className="text-[11.5px] text-muted-foreground">Provável mesma pessoa:</span>}
          {provavel && (
            <Button type="button" size="xs" variant="outline" onClick={() => onLigar(item, provavel.id)}>
              <Link2 />
              Ligar a {provavel.name}
            </Button>
          )}
          {item.candidatos.map((c) => (
            <Button key={c.leadId} type="button" size="xs" variant="outline" onClick={() => onLigar(item, c.leadId)}>
              <Link2 />
              Ligar a {c.nome || porId.get(c.leadId)?.name || 'cliente'}
            </Button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente por nome ou telefone"
          aria-label={`Buscar cliente para ${item.nome}`}
          className={CAMPO}
        />
      </div>
      {resultados.length > 0 && (
        <ul aria-label={`Clientes para ${item.nome}`} className="flex flex-col gap-0.5">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onLigar(item, c.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] outline-none transition-colors hover:bg-muted focus-visible:anel-foco focus-visible:ring-inset"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground"><ContactPhone lead={c} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function PassoPrevia({ plano, clientes, manuais, onLigar, onDesfazer }) {
  const previa = plano?.previa || {};
  const avisos = plano?.avisos || [];
  const porId = useMemo(() => new Map((clientes || []).map((c) => [c.id, c])), [clientes]);
  const paraLigar = alunosParaLigar(previa);
  const ligadosAMao = Object.entries(manuais || {}).map(([chave, m]) => ({ chave, nome: m.nomeNextFit, lead: porId.get(m.leadId) }));
  const porProfessor = previa.porProfessor || [];
  const fora = previa.listas?.foraSemContrato || [];
  const voltas = voltasDaPrevia(previa);
  const deFora = linhasDeFora(previa);
  const datas = datasDaPrevia(previa);
  const presencas = linhaDasPresencas(previa);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12.5px] text-muted-foreground">{datas ? `${datas}. ` : ''}Nada foi gravado ainda.</p>

      {avisos.length > 0 && (
        <ul aria-label="Avisos da prévia" className="flex flex-col gap-2">
          {avisos.map((a, i) => (
            <li key={`${a?.codigo ?? 'aviso'}-${i}`} className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12.5px] text-foreground">
              <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{textoDoAviso(a)}</span>
            </li>
          ))}
        </ul>
      )}

      <Secao titulo="Números" dica="Quantos alunos entram em cada marco, quantos são urgentes, quantos voltaram, quantos fecharam e quantos seguem só na lista.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cartoesDaPrevia(previa).map((c) => (
            <Numero key={c.id} rotulo={c.rotulo} valor={c.valor} tom={c.tom} detalhe={c.detalhe} />
          ))}
        </div>
        {presencas && <p className="num text-[12px] text-muted-foreground">{presencas}</p>}
      </Secao>

      {porProfessor.length > 0 && (
        <Secao titulo="Por professor" dica="Quanto fica com cada professor depois da importação.">
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {porProfessor.map((p) => (
              <li key={p.professorId ?? 'sem-professor'} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="truncate font-medium">{p.nome || (p.professorId ? 'Professor sem cadastro' : 'Sem professor')}</span>
                <span className="num shrink-0 text-muted-foreground">
                  {p.alunos === 1 ? '1 aluno' : `${p.alunos ?? 0} alunos`}
                  {` · ${p.pendentes === 1 ? '1 tarefa' : `${p.pendentes ?? 0} tarefas`}`}
                  {p.urgentes > 0 ? ` · ${p.urgentes === 1 ? '1 urgente' : `${p.urgentes} urgentes`}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {(paraLigar.length > 0 || ligadosAMao.length > 0) && (
        <Secao
          titulo="Alunos não ligados"
          dica="Ligue à mão quem você reconhece. A ligação fica guardada para as próximas importações, e quem ficar sem ligação continua de fora."
        >
          {paraLigar.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {paraLigar.map((item) => (
                <LigarAluno key={item.chave} item={item} clientes={clientes} porId={porId} onLigar={onLigar} />
              ))}
            </ul>
          )}
          {ligadosAMao.length > 0 && (
            <ul aria-label="Ligados à mão nesta importação" className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {ligadosAMao.map((l) => (
                <li key={l.chave} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{l.nome}</span>
                    <span className="text-muted-foreground"> ligado a </span>
                    <span className="font-semibold">{l.lead?.name || 'cliente'}</span>
                  </span>
                  <Button type="button" size="xs" variant="ghost" onClick={() => onDesfazer(l.chave)}>Desfazer</Button>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      {fora.length > 0 && (
        <Secao titulo="Fora por contrato" dica="Estão sem contrato ativo ou com o contrato trancado no Stronilead. Não entram na lista nem na Meta.">
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {fora.map((f) => (
              <li key={f.leadId} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <span className="truncate font-medium">{f.nome || porId.get(f.leadId)?.name || 'Cliente'}</span>
                <span className="shrink-0 text-muted-foreground">{MOTIVO_FORA[f.motivo] || MOTIVO_FORA.sem_contrato_ativo}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {voltas.length > 0 && (
        <details className="rounded-xl border border-border px-4 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-semibold">Quem voltou ({voltas.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {voltas.map((v) => (
              <li key={v.leadId}><span className="font-medium">{v.nome}</span> <span className="text-muted-foreground">{v.quando}</span></li>
            ))}
          </ul>
        </details>
      )}

      {deFora.length > 0 && (
        <details className="rounded-xl border border-border px-4 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-semibold">Linhas que ficaram de fora ({deFora.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {deFora.map((e) => (
              <li key={`${e.arquivo}-${e.numero}`} className="text-muted-foreground">
                {e.arquivo}, linha {e.numero}{e.nome ? `, ${e.nome}` : ''}: {e.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
