import { useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog.jsx';
import { Button } from '../../../components/ui/button.jsx';
import { useToast } from '../../../contexts/ToastContext.jsx';
import { useGeneralConfig } from '../../../contexts/GeneralConfigContext.jsx';
import { readSpreadsheetFile } from '../../../lib/spreadsheetRead.js';
import { configDasTelas } from '../../../lib/faltosos/configFaltosos.js';
import { hojeEmBrasilia } from '../../../lib/faltosos/dias.js';
import { lembreteExportacao } from '../../../lib/faltosos/abaFaltosos.js';
import { lerBaseDaImportacao } from '../../../lib/faltosos/lerImportacao.js';
import { planejarImportacao } from '../../../lib/faltosos/planoImportacao.js';
import { gravarImportacao } from '../../../lib/faltosos/gravarImportacao.js';
import {
  PASSOS, RECUSA_ILEGIVEL, classificarArquivo, colocarArquivo, desfazerLigacao, entradaDoPlano,
  escolhasIniciais, falhaDaGravacao, ligarAMao, mensagemDeErroDaLeitura, mesesDoPresencas, recusaDosArquivos,
  todosEscolhidos,
} from '../../../lib/faltosos/passosImportacao.js';
import { PassoArquivos } from './PassoArquivos.jsx';
import { PassoProfessores } from './PassoProfessores.jsx';
import { PassoPrevia } from './PassoPrevia.jsx';
import { PassoGravacao } from './PassoGravacao.jsx';

// ==========================================
// IMPORTAR PLANILHAS DA NEXT FIT, só do gestor, aberta pelo bloco Faltosos de
// Configurações → Metas & ritmo (src/views/settings/FaltososPanel.jsx). Spec:
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md, "As
// importações".
//
// Arquivos → (Professores, só com nome novo) → Prévia → Gravação. Nada é
// gravado antes do Confirmar: a ligação dos professores novos e a dos alunos
// ligados à mão vão junto com o resto, pelo gravarImportacao. Toda regra mora
// em src/lib/faltosos/; aqui é estado, handlers e tela. Nada de useEffect: a
// leitura do arquivo, a leitura da base e a gravação rodam nos handlers, e a
// prévia sai de useMemo, refeita a cada ligação à mão.
//
// A academia e o instante ficam presos na abertura da janela: tudo o que a
// importação lê e grava é dessa academia, e as contas usam um "agora" só. No
// Confirmar, a gravação relê o estado de cada aluno e refaz o plano com a
// mesma entrada da prévia (replanejar), para não gravar em cima do que mudou
// enquanto a prévia estava aberta, e recusa se outra importação entrou nesse
// meio tempo.
// ==========================================

const ETAPAS = [
  { id: PASSOS.ARQUIVOS, rotulo: 'Arquivos' },
  { id: PASSOS.PROFESSORES, rotulo: 'Professores' },
  { id: PASSOS.PREVIA, rotulo: 'Prévia' },
  { id: PASSOS.GRAVANDO, rotulo: 'Gravação' },
];
const ORDEM = { [PASSOS.ARQUIVOS]: 0, [PASSOS.LENDO]: 0, [PASSOS.PROFESSORES]: 1, [PASSOS.PREVIA]: 2, [PASSOS.GRAVANDO]: 3, [PASSOS.PRONTO]: 4 };

function Etapas({ passo, comProfessores }) {
  const atual = ORDEM[passo];
  const etapas = comProfessores ? ETAPAS : ETAPAS.filter((e) => e.id !== PASSOS.PROFESSORES);
  return (
    <ol aria-label="Etapas da importação" className="flex flex-wrap items-center gap-2 text-[12px]">
      {etapas.map((e, i) => {
        const n = ORDEM[e.id];
        const estado = n < atual ? 'feita' : n === atual ? 'atual' : 'depois';
        return (
          <li key={e.id} aria-current={estado === 'atual' ? 'step' : undefined} className="flex items-center gap-2">
            <span className={cn(
              'grid size-6 place-items-center rounded-full text-[11px] font-bold',
              estado === 'atual' && 'bg-primary text-primary-foreground',
              estado === 'feita' && 'bg-emerald-600 text-white',
              estado === 'depois' && 'bg-muted text-muted-foreground',
            )}>
              {estado === 'feita' ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('font-semibold', estado === 'depois' && 'text-muted-foreground')}>{e.rotulo}</span>
            {i < etapas.length - 1 && <span aria-hidden="true" className="h-px w-5 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

const DESCRICAO = {
  [PASSOS.ARQUIVOS]: 'Mande o Faltantes, o Presenças ou os dois. Nada é gravado antes do Confirmar.',
  [PASSOS.LENDO]: 'Lendo os clientes e as importações anteriores…',
  [PASSOS.PROFESSORES]: 'Ligue os professores novos da Next Fit ao cadastro de professores.',
  [PASSOS.PREVIA]: 'Confira o que vai ser gravado.',
  [PASSOS.GRAVANDO]: 'Gravando a importação.',
  [PASSOS.PRONTO]: 'Pronto.',
};

export function ImportarPlanilhasDialog({ appUser, db, onClose }) {
  const toast = useToast();
  const { professores, faltosos } = useGeneralConfig();
  const configDaTela = configDasTelas(faltosos);
  const [tenant] = useState(() => appUser?.tenantId || null);
  const [agora] = useState(() => new Date());
  const hojeDia = hojeEmBrasilia(agora);

  const [passo, setPasso] = useState(PASSOS.ARQUIVOS);
  const [arquivos, setArquivos] = useState({ faltantes: null, presencas: null });
  const [recusas, setRecusas] = useState([]);
  const [lendoArquivos, setLendoArquivos] = useState(false);
  const [problemaDaBase, setProblemaDaBase] = useState(null);
  const [base, setBase] = useState(null);              // lerBaseDaImportacao
  const [novos, setNovos] = useState([]);              // os professores novos do plano
  const [escolhas, setEscolhas] = useState({});        // nome da Next Fit → professorId | SEM_PROFESSOR
  const [manuais, setManuais] = useState({});          // chave do nome → { nomeNextFit, leadId }
  const [envio, setEnvio] = useState(null);            // { plano, entrada } da prévia confirmada
  const [progresso, setProgresso] = useState({ gravadas: 0, total: 0 });
  const [falha, setFalha] = useState(null);            // { texto, podeTentar }
  const [pronto, setPronto] = useState(null);          // { jaExistia }
  const ocupadoRef = useRef(false);

  // A recusa que já se vê só com os arquivos (Faltantes mais antigo que o
  // último importado), sem ler a base.
  const recusaAntes = useMemo(
    () => recusaDosArquivos({ arquivos, config: configDaTela, agora }),
    [arquivos, configDaTela, agora],
  );
  const problemas = [recusaAntes?.mensagem, problemaDaBase].filter(Boolean);
  const temArquivo = Boolean(arquivos.faltantes || arquivos.presencas);
  const lembrete = lembreteExportacao({ marcos: configDaTela.marcos, ultimaImportacao: configDaTela.ultimaImportacao, hojeDia });

  const naPrevia = passo === PASSOS.PREVIA;
  const plano = useMemo(() => {
    if (!base || !naPrevia) return null;
    const entrada = entradaDoPlano({ arquivos, base, professores, novos, escolhas, manuais, agora });
    try {
      return { ok: true, valor: planejarImportacao(entrada), entrada };
    } catch (erro) {
      console.error('planejarImportacao', erro);
      return { ok: false, erro };
    }
  }, [base, naPrevia, arquivos, professores, novos, escolhas, manuais, agora]);
  const podeConfirmar = Boolean(plano?.ok && plano.valor.prontoParaGravar && !plano.valor.recusa);

  // Durante a gravação a janela não fecha; parada com erro, fecha.
  const travada = passo === PASSOS.GRAVANDO && !falha;
  const fechar = () => { if (!travada) onClose?.(); };

  // Arquivo novo pede leitura nova da base e uma prévia do par de agora.
  const esquecerBase = () => {
    setBase(null);
    setNovos([]);
    setEscolhas({});
    setManuais({});
    setProblemaDaBase(null);
  };

  const receberArquivos = async (files) => {
    setLendoArquivos(true);
    let proximos = arquivos;
    const novasRecusas = [];
    try {
      for (const file of files) {
        try {
          const { headers, rows } = await readSpreadsheetFile(file);
          const lido = classificarArquivo({ nome: file.name, headers, rows });
          if (lido.recusa) novasRecusas.push({ nome: file.name, motivo: lido.recusa });
          else proximos = colocarArquivo(proximos, lido);
        } catch (err) {
          console.error('readSpreadsheetFile', err);
          novasRecusas.push({ nome: file.name, motivo: RECUSA_ILEGIVEL });
        }
      }
    } finally {
      setArquivos(proximos);
      setRecusas(novasRecusas);
      esquecerBase();
      setLendoArquivos(false);
    }
  };

  const tirarArquivo = (tipo) => {
    setArquivos((a) => ({ ...a, [tipo]: null }));
    setRecusas([]);
    esquecerBase();
  };

  // Lê a base e roda o plano uma vez para saber se há professor novo. O plano
  // recusa de novo, agora com a configuração do servidor, o Faltantes mais
  // antigo que o último: outra importação pode ter entrado depois que a aba
  // abriu.
  const lerBase = async () => {
    setPasso(PASSOS.LENDO);
    try {
      const lida = await lerBaseDaImportacao({ db, tenant, mesesPresencas: mesesDoPresencas(arquivos.presencas) });
      const primeiro = planejarImportacao(entradaDoPlano({ arquivos, base: lida, professores, agora }));
      if (primeiro.recusa) {
        setProblemaDaBase(primeiro.recusa.mensagem);
        setPasso(PASSOS.ARQUIVOS);
        return;
      }
      const pendentes = primeiro.pendencias.professoresNovos;
      setBase(lida);
      setNovos(pendentes);
      setEscolhas(escolhasIniciais(pendentes));
      setManuais({});
      setPasso(pendentes.length ? PASSOS.PROFESSORES : PASSOS.PREVIA);
    } catch (err) {
      console.error('lerBaseDaImportacao', err);
      toast.error(mensagemDeErroDaLeitura(err));
      setPasso(PASSOS.ARQUIVOS);
    }
  };

  // Grava o plano da prévia confirmada. A gravação relê o estado de cada aluno
  // e roda o plano de novo com a mesma entrada (replanejar), e o registro
  // guarda os números da prévia confirmada. Se ela parar no meio, "Tentar de
  // novo" grava o mesmo envio: os ids são fixos, nada se repete.
  const gravar = async (atual) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setEnvio(atual);
    setFalha(null);
    setProgresso({ gravadas: 0, total: 0 });
    setPasso(PASSOS.GRAVANDO);
    try {
      const res = await gravarImportacao({
        db,
        tenant,
        plano: atual.plano,
        replanejar: (estadosAtuais) => planejarImportacao({ ...atual.entrada, estadosAtuais }),
        ultimaImportacaoLida: base?.configDoc?.ultimaImportacao ?? null,
        quem: { uid: appUser?.authUid || null, id: appUser?.id || null, nome: appUser?.name || '' },
        onProgress: (gravadas, total) => setProgresso({ gravadas, total }),
      });
      if (!res?.ok) {
        setFalha(falhaDaGravacao({ resultado: res }));
        return;
      }
      setPronto({ jaExistia: Boolean(res.jaExistia) });
      setPasso(PASSOS.PRONTO);
      toast.success('Importação gravada.');
    } catch (err) {
      console.error('gravarImportacao', err);
      setFalha(falhaDaGravacao({ lancado: err }));
    } finally {
      ocupadoRef.current = false;
    }
  };

  const confirmar = () => {
    if (!podeConfirmar) return;
    gravar({ plano: plano.valor, entrada: plano.entrada });
  };

  const voltar = () => {
    if (passo === PASSOS.PREVIA && novos.length) setPasso(PASSOS.PROFESSORES);
    else {
      esquecerBase();
      setPasso(PASSOS.ARQUIVOS);
    }
  };

  let conteudo = null;
  let rodape = null;
  if (passo === PASSOS.ARQUIVOS || passo === PASSOS.LENDO) {
    conteudo = (
      <PassoArquivos
        arquivos={arquivos}
        recusas={recusas}
        problemas={problemas}
        lembrete={lembrete}
        lendo={lendoArquivos}
        travado={passo === PASSOS.LENDO}
        onArquivos={receberArquivos}
        onTirar={tirarArquivo}
      />
    );
    rodape = (
      <>
        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
        <Button type="button" onClick={lerBase} disabled={!temArquivo || problemas.length > 0 || lendoArquivos || passo === PASSOS.LENDO}>
          {passo === PASSOS.LENDO && <Loader2 className="animate-spin" />}
          {passo === PASSOS.LENDO ? 'Lendo…' : 'Continuar'}
        </Button>
      </>
    );
  } else if (passo === PASSOS.PROFESSORES) {
    conteudo = (
      <PassoProfessores
        novos={novos}
        escolhas={escolhas}
        professores={professores}
        onEscolher={(nome, valor) => setEscolhas((e) => ({ ...e, [nome]: valor }))}
      />
    );
    rodape = (
      <>
        <Button type="button" variant="ghost" onClick={voltar}>Voltar</Button>
        <Button type="button" onClick={() => setPasso(PASSOS.PREVIA)} disabled={!todosEscolhidos(novos, escolhas)}>Continuar</Button>
      </>
    );
  } else if (passo === PASSOS.PREVIA) {
    conteudo = plano?.ok
      ? (
        <PassoPrevia
          plano={plano.valor}
          clientes={base.clientes}
          manuais={manuais}
          onLigar={(item, leadId) => setManuais((m) => ligarAMao(m, item, leadId))}
          onDesfazer={(chave) => setManuais((m) => desfazerLigacao(m, chave))}
        />
      )
      : <p role="alert" className="text-[12.5px] text-destructive">Não deu para montar a prévia com esses arquivos. Confira se são os relatórios certos e tente de novo.</p>;
    rodape = (
      <>
        <Button type="button" variant="ghost" onClick={voltar}>Voltar</Button>
        <Button type="button" onClick={confirmar} disabled={!podeConfirmar}>Confirmar e gravar</Button>
      </>
    );
  } else {
    conteudo = <PassoGravacao progresso={progresso} falha={falha} pronto={passo === PASSOS.PRONTO ? pronto : null} />;
    if (passo === PASSOS.PRONTO) {
      rodape = <Button type="button" onClick={fechar}>Fechar</Button>;
    } else if (falha) {
      rodape = (
        <>
          <Button type="button" variant="ghost" onClick={fechar}>Fechar</Button>
          {falha.podeTentar && <Button type="button" onClick={() => gravar(envio)}>Tentar de novo</Button>}
        </>
      );
    }
  }

  return (
    <Dialog open onOpenChange={(aberta) => { if (!aberta) fechar(); }}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        overlayClassName="z-[210]"
        className="z-[210] flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 sm:max-w-[820px]"
      >
        <div className="flex flex-col gap-3 border-b border-border px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <DialogTitle className="font-display text-[18px] font-bold tracking-tight">Importar planilhas da Next Fit</DialogTitle>
              <DialogDescription className="text-[12.5px]">{DESCRICAO[passo]}</DialogDescription>
            </div>
            {!travada && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={fechar} aria-label="Fechar">
                <X />
              </Button>
            )}
          </div>
          <Etapas passo={passo} comProfessores={novos.length > 0} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{conteudo}</div>
        {rodape && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">{rodape}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
