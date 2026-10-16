// Faixa branca de uma seção da tela Gerencial (mockup A): título com o "?",
// a pergunta que a seção responde em uma linha, e o conteúdo. Sem borda
// pesada: a faixa se separa da página pelo fundo, não por uma caixa.
// `aside` fica no canto direito do título, como o saldo da base no
// Operacional.
import { cn } from '../../lib/utils.js';
import { DashHelpTip } from './DashPrimitives.jsx';

export function Band({ title, question, help, aside, className, children }) {
  return (
    <section className={cn('rounded-[18px] border border-border bg-card px-5 py-6 shadow-card sm:px-7', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="m-0 font-display text-[20px] font-bold tracking-[-0.015em]">{title}</h2>
          {help && <DashHelpTip text={help} label={`O que é "${title}"?`} />}
        </div>
        {aside}
      </div>
      {question && <p className="mb-[18px] mt-1 text-[13.5px] text-muted-foreground">{question}</p>}
      {!question && <div className="mb-[18px]" />}
      {children}
    </section>
  );
}
