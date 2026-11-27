import { lazy, Suspense, useEffect, useState } from 'react';
import { AlertTriangle, CalendarX, FileSpreadsheet, Plus, Upload, X } from 'lucide-react';
import { collection, doc, documentId, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { appId, CONFIG_PATH, CONFIG_FALTOSOS_ID, FALTOSOS_PATH, LEADS_PATH } from '../../lib/firebase.js';
import { chunk } from '../../lib/operacional/queries.js';
import { useRegistroDaImportacao } from '../../hooks/useRegistroDaImportacao.js';
import { configDasTelas } from '../../lib/faltosos/configFaltosos.js';
import { hojeEmBrasilia } from '../../lib/faltosos/dias.js';
import { importaFaltosos, lembreteExportacao, resumoDaUltimaImportacao } from '../../lib/faltosos/abaFaltosos.js';
import {
  MARCOS_MAX, adicionarMarco, removerMarco, validarJanelaUrgente, trocarLigacaoProfessor,
  ligacoesEmOrdem, opcoesDeProfessor,
} from '../../lib/faltosos/configuracoes.js';
import { cn } from '../../lib/utils.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SettingsPanel } from '../../components/ui/SettingsCard.jsx';
import { DialogField, EmptyState, FIELD_INPUT, FormDialog, PanelNote, SettingsBtn } from './settingsBits.jsx';

// A janela de importação só carrega quando o gestor abre: ela traz o motor da
// importação e a gravação, e a gravação lê os caminhos do Firestore já ao
// carregar o arquivo. Com import direto, todo teste que troca o firebase.js por
// um dublê sem esses caminhos e monta este bloco quebraria, a começar pelo
// faltososPanel.test.js.
const ImportarPlanilhasDialog = lazy(() => import('../faltosos/importacao/ImportarPlanilhasDialog.jsx')
  .then((m) => ({ default: m.ImportarPlanilhasDialog })));

// Os alunos faltando que a importação deixou sem professor (professorId null),
// com o nome lido do lead, em lotes de 30. Uma leitura na abertura do bloco.
function useSemProfessor({ db, enabled }) {
  const [nomes, setNomes] = useState([]);
  useEffect(() => {
    if (!db || !enabled) return undefined;
    let vivo = true;
    const col = (path) => collection(db, 'artifacts', appId, 'public', 'data', path);
    (async () => {
      const snap = await getDocs(query(col(FALTOSOS_PATH), where('professorId', '==', null)));
      const ids = snap.docs.filter((d) => d.data().status === 'faltando').map((d) => d.id);
      const lidos = [];
      for (const lote of chunk(ids, 30)) {
        const leads = await getDocs(query(col(LEADS_PATH), where(documentId(), 'in', lote)));
        leads.docs.forEach((d) => lidos.push(d.data().name || 'Sem nome'));
      }
      if (vivo) setNomes(lidos.sort((a, b) => a.localeCompare(b, 'pt-BR')));
    })().catch(() => {});
    return () => { vivo = false; };
  }, [db, enabled]);
  return nomes;
}

// Bloco "Faltosos" de Configurações → Metas & ritmo (spec
// docs/superpowers/specs/2026-10-02-professor-e-faltosos-design.md,
// "Configurações", e docs/superpowers/specs/2026-10-16-professor-pr2-em-tres-partes-design.md,
// "2A: a importação"). Grava stronix_config/faltosos com merge, um campo por
// vez, como o resto de Metas & ritmo grava o "general": a tela muda quando a
// assinatura do App.jsx traz o documento de volta.
//
// - Importação: a última (quando, quem, a data do Faltantes e o período do
//   Presenças), como exportar da Next Fit e o botão "Importar planilhas", que
//   abre a janela de importação.
// - Marcos de falta: de 1 a 6 números de dias, de 1 a 365, sem repetir.
// - Janela do urgente: em dias.
// - Professores da Next Fit: cada nome que já veio no Faltantes, com o
//   professor do cadastro ligado a ele, para trocar. A lista só cresce pela
//   importação.
//
// Tudo vale a partir da próxima importação. Os alunos já importados ficam com
// o professor, o marco e o urgente que tinham até lá.
//
// Quem vê: o gestor, com o módulo ligado (importaFaltosos, pelo appUser que a
// SettingsView passa à PaceSection), e só com a configuração já lida (o
// `pronta`, que o App liga quando a assinatura de stronix_config/faltosos
// traz o documento, no GeneralConfigContext). Antes da leitura o bloco não
// aparece, para ninguém editar em cima do padrão e gravar por cima do que a
// academia já tem. Leitura que falhou (`erro`) mostra só o aviso, sem botão:
// o bloco não sabe a última importação nem o que está salvo. Por fora,
// Configurações só abre para o gestor (trava `gestor` de SCREENS.settings), e
// as regras só deixam o gestor gravar em stronix_config.
export function FaltososPanel({ db, appUser }) {
  const toast = useToast();
  const { professores, faltosos } = useGeneralConfig();
  const { marcos, janelaUrgenteDias, professorLinks, ultimaImportacao, pronta, erro } = configDasTelas(faltosos);
  const [novoMarcoAberto, setNovoMarcoAberto] = useState(false);
  const [novoMarco, setNovoMarco] = useState('');
  const [gravando, setGravando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [hojeDia] = useState(() => hojeEmBrasilia());
  const visivel = importaFaltosos(appUser) && pronta && !erro;
  const registro = useRegistroDaImportacao({ db, id: visivel ? ultimaImportacao?.id : null });
  const semProfessor = useSemProfessor({ db, enabled: visivel });
  const naoAchados = registro?.naoLigados || [];

  if (!importaFaltosos(appUser) || !pronta) return null;

  if (erro) {
    return (
      <SettingsPanel icon={<CalendarX size={16} />} iconTone="amber" title="Faltosos">
        <p role="alert" className="flex items-start gap-2 px-5 py-4 border-t border-border text-[12.5px] text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>Não deu para ler a configuração dos faltosos. Recarregue a página.</span>
        </p>
      </SettingsPanel>
    );
  }

  // A ref é montada na hora de gravar, não no render: render não toca no SDK.
  const salvar = (campos) => setDoc(
    doc(db, 'artifacts', appId, 'public', 'data', CONFIG_PATH, CONFIG_FALTOSOS_ID),
    { ...campos, updatedAt: serverTimestamp() },
    { merge: true }
  );

  const gravarMarcos = async (lista) => {
    setGravando(true);
    try {
      await salvar({ marcos: lista });
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os marcos de falta.');
      return false;
    } finally {
      setGravando(false);
    }
  };

  const incluirMarco = async () => {
    const r = adicionarMarco(marcos, novoMarco);
    if (r.erro) { toast.warning(r.erro); return; }
    if (await gravarMarcos(r.marcos)) {
      setNovoMarco('');
      setNovoMarcoAberto(false);
    }
  };

  const tirarMarco = async (n) => {
    const r = removerMarco(marcos, n);
    if (r.erro) { toast.warning(r.erro); return; }
    await gravarMarcos(r.marcos);
  };

  // Salva ao sair do campo, como a meta de prospecção. Valor inválido volta
  // para o salvo.
  const salvarJanela = async (campo) => {
    const r = validarJanelaUrgente(campo.value);
    if (r.erro) {
      toast.warning(r.erro);
      campo.value = String(janelaUrgenteDias);
      return;
    }
    if (r.dias === janelaUrgenteDias) return;
    try {
      await salvar({ janelaUrgenteDias: r.dias });
      toast.success(`Urgente: contrato terminando em até ${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}. Vale a partir da próxima importação.`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a janela do urgente.');
      campo.value = String(janelaUrgenteDias);
    }
  };

  const trocarProfessor = async (nome, professorId) => {
    try {
      await salvar({ professorLinks: trocarLigacaoProfessor(professorLinks, nome, professorId) });
      toast.success('Ligação salva. Vale a partir da próxima importação.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a ligação do professor.');
    }
  };

  const ligacoes = ligacoesEmOrdem(professorLinks);
  const umDia = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
  const resumo = resumoDaUltimaImportacao(ultimaImportacao);
  const lembrete = lembreteExportacao({ marcos, ultimaImportacao, hojeDia });

  return (
    <>
      <SettingsPanel
        icon={<CalendarX size={16} />}
        iconTone="amber"
        title="Faltosos"
        hint="A importação das planilhas da Next Fit e as regras da lista de faltosos que ela monta para cada professor."
        action={(
          <SettingsBtn kind="primary" icon={<Upload size={13} />} onClick={() => setImportando(true)}>
            Importar planilhas
          </SettingsBtn>
        )}
      >
        <section aria-labelledby="faltosos-importacao" className="flex items-start gap-3 px-5 py-4 border-t border-border">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
            <FileSpreadsheet size={16} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h4 id="faltosos-importacao" className="text-[13px] font-semibold">
              {resumo ? `Última importação: ${resumo.quando}` : 'Nenhuma importação ainda'}
            </h4>
            {resumo && <p className="text-[11.5px] text-muted-foreground">{resumo.faltantes} · {resumo.presencas}</p>}
            <p className="text-[11.5px] text-muted-foreground max-w-[460px] text-pretty">
              Como exportar da Next Fit. {lembrete.faltantes} {lembrete.presencas}
            </p>
          </div>
        </section>

        <section aria-labelledby="faltosos-marcos" className="flex flex-col gap-3 px-5 py-4 border-t border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h4 id="faltosos-marcos" className="text-[13px] font-semibold">Marcos de falta</h4>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
                Dias sem vir em que o aluno vira tarefa de contato para o professor. Cada marco vale um contato. Depois do último, o aluno fica só na lista de acompanhamento.
              </p>
            </div>
            <SettingsBtn
              kind="dashed"
              size={34}
              icon={<Plus size={13} />}
              onClick={() => setNovoMarcoAberto(true)}
              disabled={marcos.length >= MARCOS_MAX}
              title={marcos.length >= MARCOS_MAX ? `São no máximo ${MARCOS_MAX} marcos.` : undefined}
            >
              Novo marco
            </SettingsBtn>
          </div>
          <ul className="flex flex-wrap gap-2">
            {marcos.map((n) => (
              <li key={n} className="inline-flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-[10px] bg-card border border-border text-[13px] font-semibold">
                <span className="num">{umDia(n)}</span>
                <button
                  type="button"
                  onClick={() => tirarMarco(n)}
                  disabled={gravando}
                  title={`Remover o marco de ${umDia(n)}`}
                  aria-label={`Remover o marco de ${umDia(n)}`}
                  className="size-5 grid place-items-center rounded-md text-muted-foreground transition hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-40 focus-visible:outline-none focus-visible:anel-foco"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faltosos-janela" className="flex items-center justify-between gap-4 flex-wrap px-5 py-4 border-t border-border">
          <div className="min-w-0">
            <h4 id="faltosos-janela" className="text-[13px] font-semibold">Janela do urgente</h4>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
              O aluno faltando vira urgente quando o contrato termina dentro desse prazo, e sobe para o topo da lista do professor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              key={janelaUrgenteDias}
              type="number" min="1" max="365" step="1"
              defaultValue={janelaUrgenteDias}
              aria-label="Janela do urgente, em dias"
              onBlur={(e) => salvarJanela(e.currentTarget)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-[88px] h-9 px-3 rounded-[10px] text-[12.5px] num text-center bg-muted/60 border border-border outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
            />
            <span className="text-[12.5px] text-muted-foreground">dias</span>
          </div>
        </section>

        <section aria-labelledby="faltosos-professores" className="border-t border-border">
          <div className="px-5 pt-4 pb-2">
            <h4 id="faltosos-professores" className="text-[13px] font-semibold">Professores da Next Fit</h4>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
              Cada nome que vem no relatório Faltantes aponta para um professor do cadastro. Com Sem professor, os alunos ficam com o gestor.
            </p>
          </div>
          {ligacoes.length === 0 ? (
            <EmptyState>Os nomes aparecem aqui depois da primeira importação do relatório Faltantes.</EmptyState>
          ) : (
            <ul className="flex flex-col">
              {ligacoes.map((l) => (
                <li key={l.nome} className="flex items-center gap-3 px-5 py-2.5 border-t border-border first:border-t-0">
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium" title={l.nome}>{l.nome}</span>
                  <select
                    value={l.professorId ?? ''}
                    onChange={(e) => trocarProfessor(l.nome, e.target.value)}
                    aria-label={`Professor ligado a ${l.nome}`}
                    className={cn(FIELD_INPUT, 'w-[220px] max-w-[55%] h-9')}
                  >
                    {opcoesDeProfessor(professores, l.professorId).map((o) => (
                      <option key={o.value || 'sem'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        {semProfessor.length > 0 && (
          <section aria-labelledby="faltosos-sem-professor" className="border-t border-border">
            <div className="px-5 pt-4 pb-2">
              <h4 id="faltosos-sem-professor" className="text-[13px] font-semibold">Sem professor <span className="num font-normal text-muted-foreground">({semProfessor.length})</span></h4>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
                Alunos faltando que ficaram sem professor. Ligue o professor da Next Fit em Professores da Next Fit, logo acima.
              </p>
            </div>
            <ul className="flex flex-col">
              {semProfessor.map((nome, i) => (
                <li key={`${nome}-${i}`} className="px-5 py-2 border-t border-border text-[13px]">{nome}</li>
              ))}
            </ul>
          </section>
        )}

        {naoAchados.length > 0 && (
          <section aria-labelledby="faltosos-nao-achados" className="border-t border-border">
            <div className="px-5 pt-4 pb-2">
              <h4 id="faltosos-nao-achados" className="text-[13px] font-semibold">Não achados <span className="num font-normal text-muted-foreground">({naoAchados.length})</span></h4>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 max-w-[460px] text-pretty">
                A importação não achou um cliente com esse nome ou telefone. Ligue na próxima.
              </p>
            </div>
            <ul className="flex flex-col">
              {naoAchados.map((n, i) => (
                <li key={`${n.nome}-${i}`} className="flex items-baseline gap-3 px-5 py-2 border-t border-border text-[13px]">
                  <span className="flex-1 min-w-0 truncate" title={n.nome}>{n.nome}</span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {[n.telefone, n.relatorio === 'faltantes' ? 'no Faltantes' : 'no Presenças'].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <PanelNote>Tudo aqui vale a partir da próxima importação. Os alunos já importados ficam como estão até lá.</PanelNote>
      </SettingsPanel>

      <FormDialog
        open={novoMarcoAberto}
        onOpenChange={(v) => { setNovoMarcoAberto(v); if (!v) setNovoMarco(''); }}
        title="Novo marco de falta"
        description="Com quantos dias sem vir o aluno vira tarefa de contato."
        submitLabel="Adicionar marco"
        submitting={gravando}
        onSubmit={incluirMarco}
      >
        <DialogField label="Dias sem vir" hint="Entre 1 e 365.">
          <input
            className={cn(FIELD_INPUT, 'num')}
            type="number" min={1} max={365} step={1} autoFocus
            value={novoMarco}
            onChange={(e) => setNovoMarco(e.target.value)}
            placeholder="ex: 21"
          />
        </DialogField>
      </FormDialog>

      {importando && (
        <Suspense fallback={null}>
          <ImportarPlanilhasDialog appUser={appUser} db={db} onClose={() => setImportando(false)} />
        </Suspense>
      )}
    </>
  );
}
