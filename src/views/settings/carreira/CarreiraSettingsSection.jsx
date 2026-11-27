import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SettingsSectionHeader } from '../../../components/ui/SettingsCard.jsx';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../../contexts/GeneralConfigContext.jsx';
import { useCarreira } from '../../../hooks/useCarreira.js';
import { gravarTrilhaDaPessoa, salvarTrilha, tirarDoPlano } from '../../../lib/carreiraWrites.js';
import { numerosDaBase } from '../../../lib/carreira/numeros.js';
import { novaTrilha, pessoasDaTrilha, pessoasPorNivel, totalDePessoas } from '../../../lib/carreira/rascunho.js';
import { hrefFor } from '../../../lib/routes.js';
import {
  BASE_UI, BOTAO_PRIMARIO, maiuscula, numerosContamTexto, paraQuemTexto, pessoasTexto, quandoTexto,
} from './carreiraTexto.js';
import { TrilhaEditor } from './TrilhaEditor.jsx';

// Configurações → Plano de carreira (spec 2026-11-26-plano-de-carreira-
// configuravel, mockup A). Sem trilha no endereço, a lista das trilhas; com
// ela, o editor. O id que não existe (ou de trilha arquivada) cai na lista. A
// trilha nova vive no estado da seção até salvar: o F5 antes disso a perde.
// Abrir a trilha empilha no histórico (link), trocar de aba troca a entrada
// (`onAba`, o goToSub do App), e arquivar ou descartar a nova voltam à lista
// com replace.
function NovaTrilha({ onCriar }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={BOTAO_PRIMARIO}>
          <Plus size={16} aria-hidden="true" />
          Nova trilha
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-muted-foreground">Para quem é a trilha?</p>
        {[['professor', 'Para professores'], ['consultor', 'Para consultores']].map(([base, rotulo]) => (
          <button
            key={base}
            type="button"
            onClick={() => onCriar(base)}
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold outline-none hover:bg-muted focus-visible:anel-foco"
          >
            {rotulo}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CartaoDaTrilha({ trilha, pessoas, href }) {
  const ui = BASE_UI[trilha.base];
  const Icone = ui.icone;
  const N = trilha.niveis.length;
  const degrau = (i) => (N === 1 ? 2 : (i * 2) / (N - 1));
  const contam = numerosDaBase(trilha.base).filter((id) => trilha.numeros[id]?.ligado).length;
  return (
    <AppLink
      to={href}
      className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-x-[18px] gap-y-3 rounded-[18px] border border-border bg-card px-[18px] py-4 shadow-card outline-none hover:border-brand-200 focus-visible:anel-foco md:grid-cols-[46px_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_20px]"
    >
      <span aria-hidden="true" className={cn('grid size-[46px] place-items-center rounded-[14px] text-white', ui.fundo)}>
        <Icone size={20} />
      </span>
      <span className="min-w-0">
        <b className="block truncate font-display text-[17px] font-bold tracking-tight">{trilha.nome}</b>
        <small className="mt-0.5 block text-[12.5px] text-muted-foreground">{paraQuemTexto(trilha)}, {pessoasTexto(pessoas)}</small>
      </span>
      <span className="col-start-2 min-w-0 md:col-start-auto">
        <span className="sr-only">{`Níveis: ${trilha.niveis.map((n) => n.nome).join(', ')}.`}</span>
        <span aria-hidden="true" className="flex h-[34px] items-end gap-1">
          {trilha.niveis.map((n, i) => (
            <span key={n.id} className={cn('block w-16 rounded-[7px_7px_3px_3px]', ui.degrau)} style={{ height: 10 + degrau(i) * 10, opacity: 0.35 + degrau(i) * 0.3 }} />
          ))}
        </span>
        <span aria-hidden="true" className="mt-1 flex gap-1">
          {trilha.niveis.map((n) => <span key={n.id} className="w-16 truncate text-[11.5px] font-semibold text-foreground/80">{n.nome}</span>)}
        </span>
      </span>
      <span className="col-start-2 text-[13px] text-foreground/80 md:col-start-auto">
        {quandoTexto(trilha)}
        <small className="block text-[12.5px] text-muted-foreground">{numerosContamTexto(contam)}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="hidden text-muted-foreground/70 md:block" />
    </AppLink>
  );
}

export function CarreiraSettingsSection({ db, appUser, usersList, listenersActive, tenantSlug, trilhaId, trilhaAba, onAba }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { professores, modalities } = useGeneralConfig();
  const { carreira, trilhas } = useCarreira({ db, listenersActive });
  const [nova, setNova] = useState(null);

  const listaHref = hrefFor(tenantSlug, 'settings', { sub: 'carreira' });
  const trilhaHref = (id) => hrefFor(tenantSlug, 'settings', { sub: 'carreira', trilhaId: id });
  const pessoasDe = (t) => pessoasPorNivel(t, { professores, usuarios: usersList });
  const voltarALista = () => navigate(listaHref, { replace: true, state: location.state });

  if (!trilhas) return <p className="text-[13px] text-muted-foreground">Carregando as trilhas…</p>;
  const aviso = carreira?.erro && (
    <p role="alert" className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">Não deu para ler as trilhas gravadas. Recarregue a página.</p>
  );

  const outrasDe = (id) => trilhas.filter((t) => t.id !== id);
  const gravada = trilhaId ? (trilhas.find((t) => t.id === trilhaId && !t.arquivada) ?? null) : null;
  const aberta = gravada ?? (trilhaId && nova?.id === trilhaId ? nova : null);

  const falhou = (err, texto) => {
    console.error(texto, err);
    toast.error(err?.paraTela ? err.message : texto);
  };

  // A aba Pessoas grava no cadastro da pessoa, na hora. Devolvem se gravou,
  // como o onSalvar do balão "Trilha e nível" espera.
  const gravarPessoa = async (pessoa, dados) => {
    try {
      await gravarTrilhaDaPessoa(db, pessoa, dados);
      toast.success('Trilha e nível salvos.');
      return true;
    } catch (err) {
      falhou(err, 'Não deu para salvar. Tente de novo.');
      return false;
    }
  };
  const tirarPessoa = async (pessoa) => {
    try {
      await tirarDoPlano(db, pessoa);
      toast.success(`${pessoa.nome || 'A pessoa'} saiu do plano de carreira.`);
      return true;
    } catch (err) {
      falhou(err, 'Não deu para tirar do plano. Tente de novo.');
      return false;
    }
  };

  if (aberta) {
    const pessoas = pessoasDe(gravada ?? aberta);
    const salvar = (rascunho) => salvarTrilha(db, {
      trilha: rascunho, gravada, outras: outrasDe(rascunho.id), pessoasPorNivel: pessoas, appUser,
    });
    const arquivar = async () => {
      try {
        await salvarTrilha(db, { trilha: { ...gravada, arquivada: true }, gravada, outras: outrasDe(gravada.id), pessoasPorNivel: pessoas, appUser });
        toast.success('Trilha arquivada.');
        voltarALista();
      } catch (err) {
        falhou(err, 'Não deu para arquivar a trilha. Tente de novo.');
      }
    };
    return (
      <div className="flex flex-col gap-4">
        {aviso}
        <TrilhaEditor
          key={aberta.id}
          inicial={aberta}
          gravada={gravada}
          outras={outrasDe(aberta.id)}
          pessoas={pessoas}
          aba={trilhaAba === 'regras' || (trilhaAba === 'pessoas' && gravada) ? trilhaAba : 'metas'}
          equipe={gravada ? pessoasDaTrilha(gravada, { professores, usuarios: usersList }) : null}
          onGravarPessoa={gravarPessoa}
          onTirarPessoa={tirarPessoa}
          onAba={(a) => onAba(aberta.id, a)}
          voltarHref={listaHref}
          modalities={modalities}
          onSalvar={salvar}
          onArquivar={arquivar}
          onDescartarNova={() => {
            setNova(null);
            voltarALista();
          }}
        />
      </div>
    );
  }

  const criar = (base) => {
    const t = novaTrilha(base, trilhas);
    setNova(t);
    navigate(trilhaHref(t.id));
  };
  const desarquivar = async (t) => {
    try {
      await salvarTrilha(db, { trilha: { ...t, arquivada: false }, gravada: t, outras: outrasDe(t.id), pessoasPorNivel: pessoasDe(t), appUser });
      toast.success('Trilha desarquivada.');
    } catch (err) {
      falhou(err, 'Não deu para desarquivar a trilha. Tente de novo.');
    }
  };
  const ativas = trilhas.filter((t) => !t.arquivada);
  const arquivadas = trilhas.filter((t) => t.arquivada);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSectionHeader
        title="Plano de carreira"
        hint="As trilhas que a equipe segue. Cada uma tem os níveis, os números que contam e a meta de cada nível."
      >
        <NovaTrilha onCriar={criar} />
      </SettingsSectionHeader>
      {aviso}
      <ul className="grid gap-3">
        {ativas.map((t) => (
          <li key={t.id}>
            <CartaoDaTrilha trilha={t} pessoas={totalDePessoas(pessoasDe(t))} href={trilhaHref(t.id)} />
          </li>
        ))}
      </ul>
      {arquivadas.length > 0 && (
        <details className="group">
          <summary className="flex w-max cursor-pointer list-none items-center gap-1.5 rounded-md px-0.5 py-1.5 text-[13px] font-semibold text-muted-foreground outline-none focus-visible:anel-foco [&::-webkit-details-marker]:hidden">
            <ChevronRight size={15} aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            {`Arquivadas (${arquivadas.length})`}
          </summary>
          <ul className="mt-1.5 grid gap-1.5">
            {arquivadas.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
                <b className="font-semibold text-foreground/80">{t.nome}</b>
                <span>{`${maiuscula(pessoasTexto(totalDePessoas(pessoasDe(t))))} nesta trilha`}</span>
                <button
                  type="button"
                  onClick={() => desarquivar(t)}
                  className="ml-auto rounded font-semibold text-brand-700 underline-offset-2 outline-none hover:underline focus-visible:anel-foco dark:text-brand-300"
                >
                  Desarquivar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
