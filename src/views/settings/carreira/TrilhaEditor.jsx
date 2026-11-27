import { useId, useState } from 'react';
import { Calendar, ChevronLeft, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { problemaDaTrilha } from '../../../lib/carreira/validacao.js';
import { com, metasEmBranco, MOTIVO_DO_ARQUIVAR, MOTIVO_DO_ARQUIVAR_COM_MUDANCA, mudou, totalDePessoas } from '../../../lib/carreira/rascunho.js';
import { TAB_TRIGGER } from '../../professores/ProfessoresComum.jsx';
import {
  BASE_UI, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, maiuscula, paraQuemTexto, pessoasTexto, quandoTexto,
} from './carreiraTexto.js';
import { TrilhaGrade } from './TrilhaGrade.jsx';
import { TrilhaPessoas } from './TrilhaPessoas.jsx';
import { TrilhaRegras } from './TrilhaRegras.jsx';

// A trilha aberta (mockup A refinado): o cabeçalho com o nome editável, as
// etiquetas e o Arquivar, as duas abas e a barra de salvar presa embaixo. O
// rascunho é da trilha, e não da aba: trocar de aba (o `aba` vem do endereço)
// não perde o que foi digitado. As duas abas ficam montadas (forceMount com
// hidden, como a aba Cadastro da ficha), para o texto que não é número ("4o")
// continuar no campo e o aviso da barra apontar para ele. `gravada` é a trilha como está no banco (null
// na trilha nova), e `pessoas` conta quem está em cada nível dela. Quem grava é
// o `onSalvar`, que devolve a promessa do salvarTrilha.
function Fato({ icone: Icone, children }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 text-[12.5px] font-semibold text-foreground/80">
      <Icone size={14} aria-hidden="true" className="text-muted-foreground" />
      {children}
    </span>
  );
}

// `equipe` (o pessoasDaTrilha da gravada), `onGravarPessoa` e `onTirarPessoa`
// são da aba Pessoas, que só existe com a trilha salva.
export function TrilhaEditor({ inicial, gravada, outras, pessoas, aba, onAba, voltarHref, modalities, onSalvar, onArquivar, onDescartarNova, equipe = null, onGravarPessoa, onTirarPessoa }) {
  const toast = useToast();
  const motivoId = useId();
  const [rascunho, setRascunho] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const nova = !gravada;
  const total = totalDePessoas(pessoas);
  const problema = problemaDaTrilha(rascunho, { gravada, outras, pessoasPorNivel: pessoas });
  const temMudanca = mudou(rascunho, gravada);
  const brancas = metasEmBranco(rascunho);
  const ui = BASE_UI[rascunho.base];
  const Icone = ui.icone;
  const arquivarTravado = total > 0 ? MOTIVO_DO_ARQUIVAR : temMudanca ? MOTIVO_DO_ARQUIVAR_COM_MUDANCA : null;

  let status = 'Nenhuma mudança ainda.';
  if (problema) status = problema.texto;
  else if (brancas > 0) status = `${brancas} ${brancas === 1 ? 'meta em branco' : 'metas em branco'}. A trilha salva assim.`;
  else if (temMudanca) status = 'Tudo certo para salvar.';

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar(rascunho);
      toast.success('Trilha salva.');
    } catch (err) {
      console.error('salvar trilha', err);
      toast.error(err?.paraTela ? err.message : 'Não deu para salvar a trilha. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tabs value={aba} onValueChange={onAba} className="gap-[18px]">
      <header className="rounded-[18px] border border-border bg-card px-[22px] pt-[18px] shadow-card">
        <AppLink to={voltarHref} className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-muted-foreground outline-none hover:text-brand-700 focus-visible:anel-foco dark:hover:text-brand-300">
          <ChevronLeft size={15} aria-hidden="true" />
          Plano de carreira
        </AppLink>
        <div className="mt-2.5 flex flex-wrap items-start gap-4">
          <span aria-hidden="true" className={cn('grid size-[46px] flex-none place-items-center rounded-[14px] text-white', ui.fundo)}>
            <Icone size={22} />
          </span>
          <div className="min-w-[240px] flex-1">
            <input
              value={rascunho.nome}
              onChange={(e) => setRascunho((t) => com(t, { nome: e.target.value }))}
              placeholder="Nome da trilha"
              aria-label="Nome da trilha"
              autoFocus={nova}
              className="-mx-1.5 mt-1 w-full rounded-lg bg-transparent px-1.5 font-display text-[26px] font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/60 hover:bg-muted/50 focus-visible:anel-foco"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Fato icone={User}>{paraQuemTexto(rascunho)}</Fato>
              <Fato icone={Users}>{`${maiuscula(pessoasTexto(total))} nesta trilha`}</Fato>
              <Fato icone={Calendar}>{quandoTexto(rascunho)}</Fato>
            </div>
          </div>
          {!nova && (
            <>
              <button
                type="button"
                aria-disabled={arquivarTravado ? 'true' : undefined}
                aria-describedby={arquivarTravado ? motivoId : undefined}
                title={arquivarTravado ?? undefined}
                onClick={() => (arquivarTravado ? toast.warning(arquivarTravado) : onArquivar())}
                className="inline-flex h-[34px] items-center rounded-[10px] border border-transparent px-3 text-[13px] font-semibold text-muted-foreground outline-none hover:border-rose-200 hover:text-rose-700 focus-visible:anel-foco aria-disabled:cursor-not-allowed aria-disabled:hover:border-transparent aria-disabled:hover:text-muted-foreground dark:hover:text-rose-300"
              >
                Arquivar trilha
              </button>
              {arquivarTravado && <span id={motivoId} className="sr-only">{arquivarTravado}</span>}
            </>
          )}
        </div>
        <TabsList
          variant="line"
          aria-label="Partes da trilha"
          className="-mx-[22px] mt-4 w-[calc(100%+44px)] justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-none border-t border-border p-0 px-[18px] group-data-[orientation=horizontal]/tabs:h-11"
        >
          <TabsTrigger value="metas" className={TAB_TRIGGER}>Níveis e metas</TabsTrigger>
          <TabsTrigger value="regras" className={TAB_TRIGGER}>Regras da trilha</TabsTrigger>
          {!nova && equipe && <TabsTrigger value="pessoas" className={TAB_TRIGGER}>Pessoas</TabsTrigger>}
        </TabsList>
      </header>

      <TabsContent value="metas" forceMount hidden={aba !== 'metas'} tabIndex={-1}>
        <TrilhaGrade trilha={rascunho} pessoas={pessoas} onMudar={setRascunho} onRegras={() => onAba('regras')} avisar={(m) => toast.warning(m)} />
      </TabsContent>
      <TabsContent value="regras" forceMount hidden={aba !== 'regras'} tabIndex={-1}>
        <TrilhaRegras
          trilha={rascunho}
          onMudar={setRascunho}
          totalDePessoas={total}
          modalities={modalities}
        />
      </TabsContent>
      {!nova && equipe && (
        <TabsContent value="pessoas" tabIndex={-1}>
          <TrilhaPessoas trilha={gravada} trilhas={[gravada, ...(outras || [])]} equipe={equipe} onGravar={onGravarPessoa} onTirar={onTirarPessoa} />
        </TabsContent>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card/95 py-2.5 pl-[18px] pr-3 shadow-card backdrop-blur">
        <span role="status" className={cn('mr-auto text-[13px]', problema ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>
          {status}
        </span>
        <button
          type="button"
          onClick={() => (nova ? onDescartarNova() : setRascunho(gravada))}
          disabled={salvando || (!nova && !temMudanca)}
          className={BOTAO_SECUNDARIO}
        >
          Descartar
        </button>
        <button type="button" onClick={salvar} disabled={salvando || Boolean(problema) || !temMudanca} className={BOTAO_PRIMARIO}>
          {salvando ? 'Salvando…' : 'Salvar trilha'}
        </button>
      </div>
    </Tabs>
  );
}
