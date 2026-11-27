import { useRef, useState } from 'react';
import { Camera, Copy, QrCode, RefreshCw } from 'lucide-react';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { RingAvatar } from '../../components/profile/RingAvatar.jsx';
import { TrilhaNivelPopover } from './TrilhaNivelPopover.jsx';
import { SeloDoNivel } from './ProfessoresTabela.jsx';
import { BOTAO, Confirmacao } from './Confirmacao.jsx';

// Cabeçalho do perfil (mockup B): a foto com o anel azul, o nome, a trilha, o
// nível com a data, as modalidades, o tempo no nível e, só para o gestor, a
// câmera e o "Trilha e nível".
// Embaixo, o link do NPS: o professor copia e baixa o QR code; só o gestor
// gera o link (e um novo, que derruba o antigo). O consultor não tem foto nem
// NPS: sem `onFoto` não há câmera, e sem `onCopiar` não há a linha do link.
// `semNome` é o texto de quem não tem nome.
export function PerfilCabecalho({ prof, modalidades = [], pode, fotoOcupada, onFoto = null, trilhas, trilha, sugeridaId, tempo, onSalvarTrilha, link, onCopiar = null, onBaixarQr, onGerarLink, semNome = 'Professor sem nome' }) {
  const desde = getSafeDateOrNull(prof.nivelDesde)?.toLocaleDateString('pt-BR') ?? null;
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[18px] border border-border bg-card px-5 py-4 shadow-card md:px-[22px]">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="relative flex-none">
          <RingAvatar name={prof.nome} photoUrl={prof.photoUrl || null} size={50} toneName="brand" showDot={false} />
          {pode && onFoto && (
            <button
              type="button"
              aria-label="Trocar a foto do professor"
              title="Trocar a foto"
              disabled={fotoOcupada}
              onClick={onFoto}
              className="absolute bottom-0 right-0 grid size-[26px] place-items-center rounded-full border-2 border-card bg-brand-600 text-white outline-none hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              <Camera size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="m-0 truncate font-display text-[24px] font-bold leading-[1.15] tracking-[-0.02em]">{prof.nome || semNome}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
            {trilha && <span className="inline-flex h-6 items-center rounded-[7px] bg-muted px-[9px] text-[12px] font-semibold text-foreground/80">Trilha {trilha.nome}</span>}
            <SeloDoNivel nome={trilha?.niveis.find((n) => n.id === prof.nivel)?.nome ?? null} desde={desde} />
            {modalidades.map((m) => (
              <span key={m} className="inline-flex h-6 items-center rounded-[7px] bg-muted px-[9px] text-[12px] font-semibold text-foreground/80">{m}</span>
            ))}
            {pode && <TrilhaNivelPopover trilhas={trilhas} trilhaId={trilha?.id ?? null} nivel={prof.nivel} sugeridaId={sugeridaId} onSalvar={onSalvarTrilha} />}
          </div>
          {tempo && (
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {tempo.texto}{tempo.falta ? `. ${tempo.falta}.` : ''}
            </p>
          )}
        </div>
      </div>
      {onCopiar && <LinhaDoLink link={link} pode={pode} onCopiar={onCopiar} onBaixarQr={onBaixarQr} onGerarLink={onGerarLink} />}
    </header>
  );
}

function LinhaDoLink({ link, pode, onCopiar, onBaixarQr, onGerarLink }) {
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const gerarRef = useRef(null);
  const gerar = async () => {
    setOcupado(true);
    try {
      await onGerarLink();
    } finally {
      setOcupado(false);
      setConfirmar(false);
      requestAnimationFrame(() => gerarRef.current?.focus());
    }
  };
  const semProtocolo = link ? link.replace(/^https?:\/\//, '') : null;
  return (
    <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-2.5 border-t border-border pt-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="whitespace-nowrap text-[13px] font-semibold">Link do NPS</span>
        {link ? (
          <>
            <span title={semProtocolo} className="num block h-[34px] min-w-0 max-w-full flex-[1_1_260px] truncate rounded-[10px] bg-muted px-2.5 text-[12.5px] leading-[34px] text-foreground/80">{semProtocolo}</span>
            <button type="button" onClick={onCopiar} className={BOTAO}><Copy size={15} aria-hidden="true" />Copiar link</button>
            <button type="button" onClick={onBaixarQr} className={BOTAO}><QrCode size={15} aria-hidden="true" />Baixar QR code</button>
            {pode && !confirmar && (
              <button ref={gerarRef} type="button" title="O link antigo para de funcionar" onClick={() => setConfirmar(true)} className={BOTAO}>
                <RefreshCw size={15} aria-hidden="true" />Gerar novo link
              </button>
            )}
          </>
        ) : pode ? (
          <button ref={gerarRef} type="button" disabled={ocupado} onClick={gerar} className={BOTAO}>
            <RefreshCw size={15} aria-hidden="true" />{ocupado ? 'Gerando…' : 'Gerar link'}
          </button>
        ) : (
          <span className="text-[13px] text-muted-foreground">O gestor ainda não gerou o link.</span>
        )}
      </div>
      {confirmar && (
        <Confirmacao
          titulo="Gerar um link novo?"
          texto="O link antigo e o QR code que já foi impresso param de funcionar. Quem for responder precisa do link novo."
          acao="Gerar novo link"
          perigo
          ocupado={ocupado}
          onConfirmar={gerar}
          onVoltar={() => { setConfirmar(false); requestAnimationFrame(() => gerarRef.current?.focus()); }}
        />
      )}
    </div>
  );
}
