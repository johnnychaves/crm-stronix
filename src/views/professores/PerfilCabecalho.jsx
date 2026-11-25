import { Camera } from 'lucide-react';
import { getSafeDateOrNull } from '../../lib/dates.js';
import { RingAvatar } from '../../components/profile/RingAvatar.jsx';
import { NivelPopover } from './NivelPopover.jsx';
import { SeloDoNivel } from './ProfessoresTabela.jsx';

// Cabeçalho do perfil (mockup B): a foto com o anel azul, o nome, o nível com
// a data, as modalidades e, só para o gestor, a câmera e o "Trocar nível". O
// link do NPS e o QR code entram no PR 4.
export function PerfilCabecalho({ prof, modalidades, pode, fotoOcupada, onFoto, onSalvarNivel }) {
  const desde = getSafeDateOrNull(prof.nivelDesde)?.toLocaleDateString('pt-BR') ?? null;
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[18px] border border-border bg-card px-5 py-4 shadow-card md:px-[22px]">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="relative flex-none">
          <RingAvatar name={prof.nome} photoUrl={prof.photoUrl || null} size={50} toneName="brand" showDot={false} />
          {pode && (
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
          <h1 className="m-0 truncate font-display text-[24px] font-bold leading-[1.15] tracking-[-0.02em]">{prof.nome || 'Professor sem nome'}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <SeloDoNivel nivel={prof.nivel} desde={desde} />
            {modalidades.map((m) => (
              <span key={m} className="inline-flex h-6 items-center rounded-[7px] bg-muted px-[9px] text-[12px] font-semibold text-foreground/80">{m}</span>
            ))}
            {pode && <NivelPopover nivel={prof.nivel} onSalvar={onSalvarNivel} />}
          </div>
        </div>
      </div>
    </header>
  );
}
