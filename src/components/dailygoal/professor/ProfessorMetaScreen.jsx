import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FocoBar, SideCard, SideSection } from '../foco/FocoParts.jsx';
import { TabsContent } from '../../ui/tabs.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { cn } from '../../../lib/utils.js';
import { hojeEmBrasilia, ddmm, diaEmBrasilia } from '../../../lib/faltosos/dias.js';
import { pendentesDe, feitosDaSemana, gruposDaSemana, resultadoTexto, motivoDe } from '../../../lib/faltosos/metaProfessor.js';
import { AgoraFalta } from './AgoraFalta.jsx';
import { FilaFaltosos } from './FilaFaltosos.jsx';
import { AgendaDoProfessor } from './AgendaDoProfessor.jsx';
import { RegistrarContatoDialog } from './RegistrarContatoDialog.jsx';

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (dia) => DIA_SEMANA[new Date(`${dia}T12:00:00`).getDay()];
const COR_RESULTADO = { vai_voltar: 'text-emerald-700 dark:text-emerald-300', quer_cancelar: 'text-rose-700 dark:text-rose-300' };
const dataDe = (v) => (v?.toDate ? v.toDate() : v);

export function ProfessorMetaScreen({
  now, live, saudacao, nomeVisto, gestorVendo, professorLigado, ultimaImportacao, marcos,
  estados, leadsById, aulas, onRegistrar, onJaVoltou,
}) {
  const hojeDia = hojeEmBrasilia(now);
  const [pulados, setPulados] = useState([]);
  const [agoraId, setAgoraId] = useState(null);
  const [troca, setTroca] = useState(null);
  const [registrando, setRegistrando] = useState(null);
  const agoraRef = useRef(null);
  const nomeDe = (id) => leadsById.get(id)?.name || '';

  const pendentes = useMemo(() => {
    const ordem = pendentesDe(estados, hojeDia, (id) => leadsById.get(id)?.name || '');
    return [...ordem.filter((d) => !pulados.includes(d.id)), ...ordem.filter((d) => pulados.includes(d.id))];
  }, [estados, hojeDia, leadsById, pulados]);
  const feitos = useMemo(() => feitosDaSemana(estados, ultimaImportacao?.importadoEm), [estados, ultimaImportacao]);
  const agora = pendentes.find((d) => d.id === agoraId) || pendentes[0] || null;
  const fila = pendentes.filter((d) => d !== agora);

  useLayoutEffect(() => { if (troca) agoraRef.current?.focus(); }, [troca]);

  const trocar = (id, pulando = false) => {
    if (!agora || !id) return;
    if (pulando) setPulados((p) => [...p.filter((x) => x !== agora.id), agora.id]);
    setTroca((t) => ({ saiu: agora.id, n: (t?.n || 0) + 1 }));
    setAgoraId(id);
  };

  const total = pendentes.length + feitos.length;
  const titulo = gestorVendo ? `Meta diária de ${nomeVisto}` : `${saudacao}, ${nomeVisto}`;
  const linhaImport = ultimaImportacao?.dataFaltantes
    ? `Faltosos da semana, da importação de ${diaDaSemana(ultimaImportacao.dataFaltantes)}, ${ddmm(ultimaImportacao.dataFaltantes)}.`
    : 'Sua lista de faltosos aparece aqui depois da primeira importação.';
  const ultimoContato = (d) => (d.tarefa?.canal
    ? { canal: d.tarefa.canal, resultado: d.tarefa.resultado, por: d.tarefa.feitaPorNome, dia: ddmm(diaEmBrasilia(dataDe(d.tarefa.feitaEm))) }
    : null);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-card px-6 py-[18px]">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-[-0.02em]">{titulo}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {professorLigado ? linhaImport : 'Seu acesso ainda não está ligado a um professor. Fale com o gestor.'}
            {professorLigado && (live
              ? <span className="ml-2 inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><i aria-hidden="true" className="size-[7px] rounded-full bg-emerald-500" />Ao vivo</span>
              : <span className="ml-2">Atualizado às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>)}
          </p>
        </div>
        {professorLigado && total > 0 && (
          <div className="grid min-w-[200px] grid-cols-[auto_auto] items-baseline gap-x-2.5 gap-y-0.5">
            <b className="num font-display text-[22px] font-bold">{feitos.length} de {total}</b>
            <span className="text-[13px] text-muted-foreground">contatos feitos</span>
            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-emerald-500" style={{ width: `${(feitos.length / total) * 100}%` }} /></span>
          </div>
        )}
      </header>
      {gestorVendo && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Você está vendo a Meta de {nomeVisto}. O que você registrar aqui fica no seu nome.</p>}
      {professorLigado && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <FocoBar tabs={[{ id: 'faltosos', label: 'Faltosos', pending: pendentes.length }]} value="faltosos" onChange={() => {}}>
            <TabsContent value="faltosos" tabIndex={-1} className="mt-4">
              {agora ? (
                <AgoraFalta
                  key={troca?.n || 0}
                  ref={agoraRef}
                  estado={agora}
                  lead={leadsById.get(agora.id)}
                  hojeDia={hojeDia}
                  now={now}
                  entrando={Boolean(troca)}
                  ultimo={ultimoContato(agora)}
                  onRegistrar={() => setRegistrando(agora)}
                  onJaVoltou={() => onJaVoltou(agora)}
                  onPular={() => trocar(fila[0]?.id, true)}
                />
              ) : (
                <section className="rounded-[18px] bg-card px-6 py-8">
                  <h2 className="font-display text-[20px] font-bold">Tudo feito nesta semana</h2>
                  <p className="text-[13px] text-muted-foreground">A próxima lista chega com a importação de segunda.</p>
                </section>
              )}
              <FilaFaltosos itens={fila} leadsById={leadsById} hojeDia={hojeDia} onPick={(id) => trocar(id)} voltouId={troca?.saiu} />
            </TabsContent>
          </FocoBar>
          <aside aria-label="Painel do dia" className="flex flex-col gap-4">
            <AgendaDoProfessor aulas={aulas} now={now} nomeVisto={nomeVisto} gestorVendo={gestorVendo} />
            <SideCard>
              <SideSection
                title="Faltosos na semana"
                items={gruposDaSemana(pendentes, marcos)}
                empty="Ninguém."
                renderItem={(g) => (
                  <div key={g.id} className="flex justify-between text-[13px]">
                    <span className={cn(g.id === 'urgentes' && g.total > 0 && 'font-semibold text-rose-700 dark:text-rose-300')}>{g.nome}</span>
                    <b className="num">{g.total}</b>
                  </div>
                )}
              />
              <SideSection
                title="Feitos nesta semana"
                count={feitos.length}
                items={feitos}
                empty="Nenhum ainda."
                renderItem={(d) => (
                  <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]">
                    <Avatar name={nomeDe(d.id)} size={26} photoUrl={leadsById.get(d.id)?.photoUrl} />
                    <span className="truncate">{nomeDe(d.id)}</span>
                    <span className={cn('text-[12px] font-semibold', COR_RESULTADO[d.tarefa.resultado] || 'text-muted-foreground')}>{d.tarefa.status === 'voltou' ? 'Já voltou' : resultadoTexto(d.tarefa.resultado)}</span>
                  </div>
                )}
              />
            </SideCard>
          </aside>
        </div>
      )}
      {registrando && (
        <RegistrarContatoDialog
          lead={leadsById.get(registrando.id) || { id: registrando.id, name: '' }}
          contexto={motivoDe(registrando)}
          onConfirm={(r) => onRegistrar(registrando, r)}
          onClose={() => setRegistrando(null)}
        />
      )}
    </div>
  );
}
