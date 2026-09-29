// Marco de início do lead cadastrado pelo Stronizap (modelo C da spec): uma
// régua fina com a pílula no meio e, embaixo, o consultor responsável (só
// quando não é quem cadastrou) e o canal da conversa. Fica no fim da linha do tempo, que é
// onde a história do lead começa. Os textos saem de lib/timeline.js.
import { StronizapMark } from '../brand/StronizapMark.jsx';
import { zapSignupDetailText, zapSignupPillText } from '../../lib/timeline.js';

export function ZapSignupMarker({ interaction }) {
  const pilula = zapSignupPillText(interaction);
  const detalhe = zapSignupDetailText(interaction);
  return (
    <div className="pt-2.5 pb-1">
      <div className="flex items-center gap-2.5">
        <div className="h-px flex-1 bg-border" />
        {/* A pílula encolhe e corta o texto antes de estourar a largura; o
            title guarda a frase inteira. */}
        <div
          className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card py-[5px] pl-1.5 pr-3"
          title={`Início · ${pilula}`}
        >
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-muted">
            <StronizapMark size={13} />
          </span>
          <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">Início</span> · {pilula}
          </span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
      {detalhe && <p className="mt-[5px] text-center text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
