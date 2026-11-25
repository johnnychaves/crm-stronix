import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '../../contexts/ToastContext.jsx';
import { METAS_PADRAO, problemaDasMetas } from '../../lib/professor/metas.js';
import { escalaDaRenovacao } from './criterios.js';

// As metas do plano de carreira (mockup A): quatro cartões, cada um com os
// campos e uma régua que mostra a meta enquanto se digita. O rascunho só
// existe depois da primeira edição; antes dele, os campos mostram as metas
// gravadas, para a resposta da assinatura chegar sem apagar nada digitado.
const CARTOES = [
  {
    grupo: 'renovacao',
    titulo: 'Renovação da carteira',
    texto: 'A média esperada muda com o nível. É o único critério com meta por nível.',
    campos: [['junior', 'Júnior', '%'], ['pleno', 'Pleno', '%'], ['senior', 'Sênior', '%']],
  },
  {
    grupo: 'nps',
    titulo: 'Nota dos alunos',
    texto: 'Média da pergunta principal, de 0 a 10. A pesquisa vale com 10 respostas ou mais e com metade da turma.',
    campos: [['meta', 'Meta da média', 'ou mais', 0.1]],
  },
  {
    grupo: 'conversao',
    titulo: 'Conversão em matrícula',
    texto: 'O professor passa quando fica acima da conversão da academia. Empate não passa.',
    campos: [['tolerancia', 'Folga abaixo da academia', 'pontos'], ['janelaDias', 'Aulas recentes que ainda não contam', 'dias']],
  },
  {
    grupo: 'aderencia',
    titulo: 'Aderência às aulas',
    texto: 'Conta por aluno e por semana, de segunda a sexta. A meta é a mesma para os três níveis.',
    campos: [['barra', 'Aulas na semana para contar', 'ou mais'], ['faixaMin', 'Faixa da meta, de', '%'], ['faixaMax', 'até', '%']],
  },
];

const paraTexto = (metas) => Object.fromEntries(Object.entries(metas).map(([g, campos]) => [
  g, Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, String(v)])),
]));
// Campo vazio vira NaN, que o problemaDasMetas recusa.
const paraNumero = (texto) => Object.fromEntries(Object.entries(texto).map(([g, campos]) => [
  g, Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)])),
]));

const idDoCampo = (grupo, k) => `meta-${grupo}-${k}`;
const idDoErro = (grupo) => `meta-${grupo}-erro`;
const PRIMARIO = 'inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white outline-none hover:bg-brand-700 focus-visible:anel-foco focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

// A régua de prévia: posições em porcentagem da largura, entre `de` e `ate`.
const pos = (x, de, ate) => Math.max(0, Math.min(100, ((x - de) / (ate - de)) * 100));
const ok = Number.isFinite;

function Regua({ children, de, ate }) {
  return (
    <div aria-hidden="true" className="relative mt-2 h-[50px]">
      <div className="absolute inset-x-0 top-[15px] h-1 rounded-sm bg-slate-200 dark:bg-white/10" />
      {children}
      <span className="absolute left-0 top-[30px] text-[11.5px] text-muted-foreground">{de}</span>
      <span className="absolute right-0 top-[30px] text-[11.5px] text-muted-foreground">{ate}</span>
    </div>
  );
}
const Zona = ({ left, right }) => <div className="absolute top-[15px] h-1 rounded-sm bg-emerald-500/60" style={{ left: `${left}%`, right: `${100 - right}%` }} />;
const Marca = ({ at, azul }) => <div className={cn('absolute top-[9px] -ml-px h-4 w-0.5 rounded-[1px]', azul ? 'bg-brand-600' : 'bg-slate-400')} style={{ left: `${at}%` }} />;
const Texto = ({ at, topo, azul, children }) => (
  <div
    className={cn(
      'absolute -translate-x-1/2 whitespace-nowrap text-center text-[11.5px] leading-tight',
      topo ? '-top-2 font-semibold text-emerald-700 dark:text-emerald-300' : 'top-[30px]',
      azul ? 'font-semibold text-brand-700 dark:text-brand-300' : !topo && 'text-muted-foreground',
    )}
    style={{ left: `${at}%` }}
  >
    {children}
  </div>
);
const virgula = (n) => String(n).replace('.', ',');

function Previa({ grupo, v, academia }) {
  if (grupo === 'renovacao') {
    const niveis = [['Júnior', v.junior], ['Pleno', v.pleno], ['Sênior', v.senior]].filter(([, n]) => ok(n));
    const [de, ate] = niveis.length ? escalaDaRenovacao(niveis.map(([, n]) => n)) : [0, 100];
    return (
      <Regua de={`${de}%`} ate={`${ate}%`}>
        {niveis.map(([nome, n]) => (
          <span key={nome}><Marca at={pos(n, de, ate)} azul /><Texto at={pos(n, de, ate)} azul>{nome}<br />{n}%</Texto></span>
        ))}
      </Regua>
    );
  }
  if (grupo === 'nps') {
    const at = ok(v.meta) ? pos(v.meta, 7, 10) : null;
    return (
      <Regua de="7" ate="10">
        {at != null && <><Zona left={at} right={100} /><Texto at={(at + 100) / 2} topo>meta {virgula(v.meta)}</Texto></>}
      </Regua>
    );
  }
  if (grupo === 'conversao') {
    if (academia == null) {
      return <Regua de="0%" ate="100%"><Texto at={50} topo>a academia ainda não tem conversão no ciclo</Texto></Regua>;
    }
    const corte = ok(v.tolerancia) ? Math.max(0, academia - v.tolerancia) : academia;
    return (
      <Regua de="0%" ate="100%">
        <Zona left={corte} right={100} />
        <Marca at={academia} />
        <Texto at={academia}>academia<br />{academia}%</Texto>
        <Texto at={(corte + 100) / 2} topo>passa acima de {corte}%</Texto>
      </Regua>
    );
  }
  const certo = ok(v.faixaMin) && ok(v.faixaMax) && v.faixaMin < v.faixaMax;
  const de = certo ? pos(v.faixaMin, 40, 80) : 0;
  const ate = certo ? pos(v.faixaMax, 40, 80) : 0;
  return (
    <Regua de="40%" ate="80%">
      {certo && <><Zona left={de} right={ate} /><Texto at={(de + ate) / 2} topo>meta {v.faixaMin}% a {v.faixaMax}%</Texto></>}
    </Regua>
  );
}

export function MetasForm({ metas, salvarMetas, academia }) {
  const toast = useToast();
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvas, setSalvas] = useState(false);

  const texto = rascunho ?? paraTexto(metas ?? METAS_PADRAO);
  const valores = paraNumero(texto);
  const problema = problemaDasMetas(valores);

  const mudar = (grupo, k, v) => {
    setSalvas(false);
    setRascunho({ ...texto, [grupo]: { ...texto[grupo], [k]: v } });
  };

  const salvar = async () => {
    if (problema || salvando) return;
    setSalvando(true);
    try {
      await salvarMetas(valores);
      setRascunho(null);
      setSalvas(true);
    } catch (err) {
      console.error('salvarMetas', err);
      toast.error('Não deu para salvar as metas. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {CARTOES.map(({ grupo, titulo, texto: apoio, campos }) => {
          const erro = problema && problema.campo.startsWith(`${grupo}.`) ? problema : null;
          return (
            <section key={grupo} aria-labelledby={`meta-${grupo}-titulo`} className="flex flex-col gap-3.5 rounded-[18px] border border-border bg-card px-[22px] py-5 shadow-card">
              <div>
                <h2 id={`meta-${grupo}-titulo`} className="m-0 font-display text-[16px] font-bold">{titulo}</h2>
                <p className="mt-1 max-w-[52ch] text-[13px] text-muted-foreground">{apoio}</p>
              </div>
              <div className="flex flex-wrap items-end gap-x-[18px] gap-y-2.5">
                {campos.map(([k, rotulo, unidade, passo]) => {
                  const invalido = erro?.campo === `${grupo}.${k}`;
                  return (
                    <div key={k} className="flex flex-col gap-1.5">
                      <label htmlFor={idDoCampo(grupo, k)} className="text-[12.5px] font-medium text-foreground/80">{rotulo}</label>
                      <span className="flex items-center gap-1.5">
                        <input
                          id={idDoCampo(grupo, k)}
                          type="number"
                          inputMode="decimal"
                          step={passo ?? 1}
                          value={texto[grupo][k]}
                          onChange={(e) => mudar(grupo, k, e.target.value)}
                          aria-invalid={invalido || undefined}
                          aria-describedby={invalido ? idDoErro(grupo) : undefined}
                          className={cn(
                            'num h-9 w-16 rounded-[10px] border bg-card px-2.5 text-right text-[15px] font-semibold text-foreground outline-none hover:border-brand-200 focus-visible:anel-foco',
                            invalido ? 'border-rose-500 text-rose-700 dark:text-rose-300' : 'border-border',
                          )}
                        />
                        <span className="text-[13px] font-medium text-muted-foreground">{unidade}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p id={idDoErro(grupo)} aria-live="polite" className="m-0 min-h-[18px] text-[12.5px] font-semibold text-rose-700 dark:text-rose-300">
                {erro?.texto ?? ''}
              </p>
              <Previa grupo={grupo} v={valores[grupo]} academia={academia} />
            </section>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-[60ch] text-[13px] text-muted-foreground">As metas valem para todos os professores. Só o gestor muda.</p>
        <span className="flex items-center gap-3">
          <span role="status" className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">{salvas ? 'Metas salvas.' : ''}</span>
          <button type="button" onClick={salvar} disabled={Boolean(problema) || salvando} className={PRIMARIO}>
            {salvando ? 'Salvando…' : 'Salvar metas'}
          </button>
        </span>
      </div>
    </div>
  );
}
