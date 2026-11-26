import { cn } from '../../../lib/utils.js';
import { FUNCAO_TEXTO, fotoDe, vinculoSelo } from '../../../lib/equipe/ficha.js';

const iniciais = (nome) => String(nome || '?').trim().split(/\s+/)
  .filter((_, i, a) => i === 0 || i === a.length - 1).map((w) => w[0]).join('').toUpperCase();

// Foto da pessoa ou, sem foto, as iniciais.
export function PessoaAvatar({ pessoa, size = 36 }) {
  const url = fotoDe(pessoa);
  const estilo = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (url) return <img src={url} alt="" style={estilo} className="flex-none rounded-full object-cover" />;
  return (
    <span style={estilo} className="grid flex-none place-items-center rounded-full bg-brand-50 font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
      {iniciais(pessoa?.nome)}
    </span>
  );
}

const FUNCAO_COR = {
  gestor: 'bg-accent-500/[0.14] text-accent-600 dark:text-accent-400',
  consultor: 'bg-muted text-slate-600 dark:text-slate-300',
  professor: 'bg-violet-500/[0.12] text-violet-700 dark:text-violet-300',
};
export function FuncaoSelo({ funcao }) {
  return <span className={cn('inline-flex h-6 items-center rounded-[7px] px-2.5 text-[12px] font-semibold', FUNCAO_COR[funcao])}>{FUNCAO_TEXTO[funcao]}</span>;
}

export function VinculoSelo({ vinculo }) {
  if (!vinculo) return <span className="text-[12px] text-muted-foreground">Sem vínculo</span>;
  return (
    <span className={cn(
      'inline-flex h-6 items-center rounded-[7px] border px-2.5 text-[12px] font-semibold',
      vinculo === 'estagio' ? 'border-amber-500/45 bg-amber-500/[0.14] text-amber-800 dark:text-amber-300' : 'border-border text-slate-700 dark:text-slate-200',
    )}>
      {vinculoSelo(vinculo)}
    </span>
  );
}

const ACESSO = {
  com: ['Com acesso', 'bg-emerald-500', 'text-emerald-700 dark:text-emerald-400'],
  convite: ['Convite enviado', 'bg-amber-500', 'text-amber-700 dark:text-amber-400'],
  sem: ['Sem acesso', 'bg-slate-300 dark:bg-slate-600', 'text-muted-foreground'],
  desligado: ['Desligado', 'bg-rose-500', 'text-rose-700 dark:text-rose-400'],
};
export function AcessoSelo({ acesso, textoDesligado = null }) {
  const [padrao, ponto, cor] = ACESSO[acesso] || ACESSO.sem;
  const texto = acesso === 'desligado' && textoDesligado ? textoDesligado : padrao;
  return (
    <span className={cn('inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] font-semibold', cor)}>
      <span aria-hidden="true" className={cn('size-[7px] flex-none rounded-full', ponto)} />{texto}
    </span>
  );
}

// Anel do que falta na ficha: "7 de 10" para o leitor de tela.
export function FichaAnel({ ok, total, size = 30 }) {
  const pct = total ? Math.round((ok / total) * 100) : 0;
  const cheio = ok === total;
  return (
    <span
      role="img"
      aria-label={`Ficha com ${ok} de ${total} itens`}
      className="grid flex-none place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${cheio ? '#10b981' : 'var(--color-brand-600)'} ${pct}%, var(--color-border) 0)` }}
    >
      <span className="grid place-items-center rounded-full bg-card text-[9.5px] font-bold text-foreground" style={{ width: size - 8, height: size - 8 }}>
        {ok}/{total}
      </span>
    </span>
  );
}
