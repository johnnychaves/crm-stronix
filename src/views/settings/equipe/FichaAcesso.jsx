import { KeyRound } from 'lucide-react';
import { isGestor, roleLabel } from '../../../lib/acesso.js';
import { dataBR, hojeIso } from '../../../lib/equipe/ficha.js';
import { SettingsBtn } from '../settingsBits.jsx';
import { AcessoSelo } from './equipeVisual.jsx';

function Linha({ rotulo, children }) {
  return (<div><dt className="text-[12px] text-muted-foreground">{rotulo}</dt><dd className="mt-0.5 text-[13.5px] font-medium">{children}</dd></div>);
}

// O que era o diálogo de editar membro, em leitura. "Editar acesso" abre o
// EditarAcessoDialog, com a regra de sempre. "Dar acesso" fica para quem pode
// ter login: o professor só com o módulo Stronix 2.0.
export function FichaAcesso({ pessoa, professorEnabled, onEditarAcesso, onTirarAcesso, onDarAcesso }) {
  const u = pessoa.user;
  const convite = pessoa.acesso === 'convite' ? pessoa.ficha?.convite : null;
  const podeDar = !pessoa.desligada && !u && !convite && (pessoa.funcao !== 'professor' || professorEnabled);
  return (
    <section aria-label="Acesso ao app" className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-display text-[15px] font-bold">Acesso ao app</h3>
        {u && <SettingsBtn size={34} icon={<KeyRound size={13} />} onClick={onEditarAcesso}>Editar acesso</SettingsBtn>}
        {u && !isGestor(u) && <SettingsBtn size={34} onClick={onTirarAcesso}>Tirar acesso</SettingsBtn>}
        {podeDar && <SettingsBtn size={34} kind="primary" icon={<KeyRound size={13} />} onClick={onDarAcesso}>Dar acesso</SettingsBtn>}
      </header>
      {u ? (
        <dl className="mt-3 grid gap-x-5 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          <Linha rotulo="Situação"><AcessoSelo acesso="com" /></Linha>
          <Linha rotulo="Papel">{roleLabel(u)}</Linha>
          <Linha rotulo="E-mail de login">{u.email}</Linha>
          {u.shiftStart && u.shiftEnd && <Linha rotulo="Turno">{`${u.shiftStart} às ${u.shiftEnd}`}</Linha>}
          {Number(u.dailyVolumeTarget) > 0 && <Linha rotulo="Meta de prospecção">{`${u.dailyVolumeTarget} ações por dia`}</Linha>}
        </dl>
      ) : convite ? (
        <dl className="mt-3 grid gap-x-5 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          <Linha rotulo="Situação"><AcessoSelo acesso="convite" /></Linha>
          <Linha rotulo="Convite enviado para">{convite.email}</Linha>
          <Linha rotulo="Vale até">{dataBR(hojeIso(new Date(convite.expiraEm)))}</Linha>
        </dl>
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {pessoa.desligada ? 'O acesso saiu no desligamento.'
            : pessoa.funcao === 'professor' ? 'Aparece na agenda das aulas experimentais e no NPS, mas não entra no Stronilead.'
              : 'Esta pessoa ainda não entra no Stronilead.'}
        </p>
      )}
    </section>
  );
}
