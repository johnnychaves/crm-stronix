import { useId } from 'react';
import { Calendar, Lock, SlidersHorizontal, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupOption } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NUMEROS, numerosDaBase } from '../../../lib/carreira/numeros.js';
import { mesesDaAvaliacao } from '../../../lib/carreira/periodo.js';
import { com, trocarAjuste, trocarBase, trocarFrequencia, trocarSugestao } from '../../../lib/carreira/rascunho.js';
import { AVISO_CALENDARIO_PROFESSOR, BASE_UI, maiuscula, MESES, NUMERO_UI, periodoTexto } from './carreiraTexto.js';
import { CampoNumero } from './CampoNumero.jsx';

// A aba Regras da trilha (mockup A): quem segue, quando avalia e como cada
// número conta, com o ajuste de cada um. `calendarioTravado` é a trava da
// trilha Professor até o PR 3 (AVISO_CALENDARIO_PROFESSOR).
const SEG = 'inline-flex w-max flex-wrap gap-0.5 rounded-xl bg-muted p-[3px]';
const PILULA = 'inline-flex h-8 items-center rounded-[9px] px-3.5 text-[13px] font-semibold text-muted-foreground data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-sm';
// O chip de escolha (vínculo) e o de marcar (modalidades): azul quando escolhido.
const CHIP = 'inline-flex h-9 items-center rounded-[10px] border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground outline-none hover:bg-muted focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=checked]:text-white aria-pressed:border-brand-600 aria-pressed:bg-brand-600 aria-pressed:text-white';
const AJUSTE = 'mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-foreground/80';
const VINCULOS = [['qualquer', 'Qualquer vínculo'], ['formado', 'Formados'], ['estagio', 'Estagiários']];

function Bloco({ icone: Icone, titulo, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-[18px] border border-border bg-card shadow-card">
      <h3 id={id} className="flex items-center gap-2.5 border-b border-border px-5 py-4 font-display text-[15px] font-bold">
        <Icone size={18} aria-hidden="true" className="text-brand-600 dark:text-brand-300" />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Regra({ rotulo, ajuda, children }) {
  return (
    <div className="grid gap-x-7 gap-y-1.5 border-t border-border px-5 py-4 first-of-type:border-t-0 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="text-[13.5px] font-semibold">
        {rotulo}
        {ajuda && <small className="mt-0.5 block text-[12px] font-medium text-muted-foreground">{ajuda}</small>}
      </div>
      <div className="grid content-start gap-2.5">{children}</div>
    </div>
  );
}

function Ajuste({ id, trilha, onMudar }) {
  const campo = (k, rotulo, depois) => (
    <CampoNumero valor={trilha.ajustes[k]} onValor={(v) => onMudar((t) => trocarAjuste(t, k, v))} depois={depois} vazio="" rotulo={rotulo} className="h-9" />
  );
  if (id === 'conversao') {
    return <div className={AJUSTE}>Aulas dos últimos {campo('janelaDias', 'Dias de aula recente que ainda não contam', 'dias')} ainda não contam, porque a pessoa pode se matricular depois.</div>;
  }
  if (id === 'aderencia') {
    return <div className={AJUSTE}>A semana conta com {campo('barra', 'Aulas na semana para contar', 'aulas')} ou mais. A faixa da meta vai até {campo('faixaMax', 'Fim da faixa da meta', '%')}</div>;
  }
  if (id === 'vendas') {
    return (
      <div className={AJUSTE}>
        Contar em
        <RadioGroup aria-label="Vendas contam em" value={trilha.ajustes.vendasEm} onValueChange={(v) => onMudar((t) => trocarAjuste(t, 'vendasEm', v))} className={SEG}>
          <RadioGroupOption value="reais" className={PILULA}>reais</RadioGroupOption>
          <RadioGroupOption value="quantidade" className={PILULA}>quantidade de vendas</RadioGroupOption>
        </RadioGroup>
        <span className="text-muted-foreground">Trocar apaga as metas de vendas.</span>
      </div>
    );
  }
  return null;
}

export function TrilhaRegras({ trilha, onMudar, totalDePessoas, modalities, calendarioTravado }) {
  // As três que vêm prontas nunca mudam de base (problemaDaTrilha).
  const baseTravada = totalDePessoas > 0 || Boolean(trilha.padrao);
  const [primeiro] = mesesDaAvaliacao(trilha);
  const semestral = trilha.frequencia === 'semestral';
  const rotuloDoMes = semestral ? 'Meses da avaliação' : 'Mês da avaliação';
  const ui = BASE_UI[trilha.base];
  const ligados = numerosDaBase(trilha.base).filter((id) => trilha.numeros[id]?.ligado);

  return (
    <div className="flex flex-col gap-4">
      <Bloco icone={User} titulo="Quem segue">
        <Regra rotulo="Para quem">
          <div className="flex flex-wrap items-center gap-2">
            <RadioGroup aria-label="Para quem" value={trilha.base} onValueChange={(v) => onMudar((t) => trocarBase(t, v))} disabled={baseTravada} className={SEG}>
              <RadioGroupOption value="professor" className={PILULA}>Professores</RadioGroupOption>
              <RadioGroupOption value="consultor" className={PILULA}>Consultores</RadioGroupOption>
            </RadioGroup>
            {baseTravada && (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-[12px] font-semibold text-muted-foreground">
                <Lock size={12} aria-hidden="true" />
                {trilha.padrao ? 'não muda nas trilhas que vêm prontas' : 'não muda com gente na trilha'}
              </span>
            )}
          </div>
        </Regra>
        {trilha.base === 'professor' && (
          <Regra rotulo="Sugerir para" ajuda="O gestor decide no perfil de cada pessoa.">
            <RadioGroup aria-label="Vínculo" value={trilha.sugestao.vinculo} onValueChange={(v) => onMudar((t) => trocarSugestao(t, { vinculo: v }))} className="flex flex-wrap gap-2">
              {VINCULOS.map(([v, rotulo]) => <RadioGroupOption key={v} value={v} className={CHIP}>{rotulo}</RadioGroupOption>)}
            </RadioGroup>
            {(modalities || []).length > 0 && (
              <div role="group" aria-label="Modalidades" className="flex flex-wrap gap-2">
                {modalities.map((m) => {
                  const on = trilha.sugestao.modalidadeIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onMudar((t) => trocarSugestao(t, {
                        modalidadeIds: on ? t.sugestao.modalidadeIds.filter((x) => x !== m.id) : [...t.sugestao.modalidadeIds, m.id],
                      }))}
                      className={CHIP}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[12.5px] text-muted-foreground">Sem modalidade marcada, a trilha serve para todas.</p>
          </Regra>
        )}
      </Bloco>

      <Bloco icone={Calendar} titulo="Quando avalia">
        {calendarioTravado && (
          <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {AVISO_CALENDARIO_PROFESSOR}
          </p>
        )}
        <Regra rotulo="Frequência">
          <RadioGroup aria-label="Frequência" value={trilha.frequencia} onValueChange={(v) => onMudar((t) => trocarFrequencia(t, v))} disabled={calendarioTravado} className={SEG}>
            <RadioGroupOption value="anual" className={PILULA}>Uma vez por ano</RadioGroupOption>
            <RadioGroupOption value="semestral" className={PILULA}>Duas vezes por ano</RadioGroupOption>
          </RadioGroup>
        </Regra>
        <Regra rotulo={rotuloDoMes}>
          <Select value={String(primeiro)} onValueChange={(v) => onMudar((t) => com(t, { mes: Number(v) }))} disabled={calendarioTravado}>
            <SelectTrigger aria-label={rotuloDoMes} className="h-10 w-[240px] rounded-[11px] border-border focus-visible:anel-foco">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(semestral ? MESES.slice(0, 6) : MESES).map((nome, i) => (
                <SelectItem key={nome} value={String(i + 1)}>
                  {semestral ? `${maiuscula(nome)} e ${MESES[i + 6]}` : maiuscula(nome)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[12.5px] text-muted-foreground">{periodoTexto(trilha)}</p>
        </Regra>
        {semestral && (
          <Regra rotulo="A renovação olha" ajuda="Seis meses têm poucos vencimentos.">
            <RadioGroup aria-label="A renovação olha" value={trilha.janelaRenovacao} onValueChange={(v) => onMudar((t) => com(t, { janelaRenovacao: v }))} className={SEG}>
              <RadioGroupOption value="periodo" className={PILULA}>Só o semestre</RadioGroupOption>
              <RadioGroupOption value="12meses" className={PILULA}>12 meses até o fim do semestre</RadioGroupOption>
            </RadioGroup>
          </Regra>
        )}
      </Bloco>

      <Bloco icone={SlidersHorizontal} titulo="Como cada número conta">
        {ligados.length === 0 && (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">Nenhum número conta nesta trilha. Ligue um na aba Níveis e metas.</p>
        )}
        {ligados.map((id) => {
          const Icone = NUMERO_UI[id].icone;
          return (
            <div key={id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3.5 border-t border-border px-5 py-4 first-of-type:border-t-0">
              <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-[11px]', ui.tile)}>
                <Icone size={18} />
              </span>
              <div>
                <b className="text-[14px] font-semibold">{NUMEROS[id].nome}</b>
                <p className="mt-0.5 max-w-[72ch] text-[13px] leading-normal text-foreground/80">{NUMERO_UI[id].regra}</p>
                <Ajuste id={id} trilha={trilha} onMudar={onMudar} />
              </div>
            </div>
          );
        })}
      </Bloco>
    </div>
  );
}
