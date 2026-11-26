import { useMemo } from 'react';
import { Briefcase, Key, Search, Users } from 'lucide-react';
import { cn } from '../../../lib/utils.js';
import { AppLink } from '../../../components/nav/AppLink.jsx';
import { FilterChip } from '../../dashboard/DashFilterBar.jsx';
import { isClientLead } from '../../../lib/leads.js';
import { professorModalityNames } from '../../../lib/professores.js';
import { FUNCAO_TEXTO, VINCULOS, admissaoDe, dataBR, desligadoEmTexto, faltasDaFicha, periodoNaEquipe, tempoDeCasa } from '../../../lib/equipe/ficha.js';
import { filtrarEquipe } from '../../../lib/equipe/equipe.js';
import { AcessoSelo, FichaAnel, FuncaoSelo, PessoaAvatar, VinculoSelo } from './equipeVisual.jsx';

const GRADE = 'minmax(220px,2fr) 1.15fr .8fr 1.05fr .95fr 44px';
const TODOS = '__todos';
const opcoes = (lista, todos) => [{ key: TODOS, label: todos }, ...lista];
const FUNCOES_OPC = Object.entries(FUNCAO_TEXTO).map(([key, label]) => ({ key, label }));
const ACESSO_OPC = [{ key: 'com', label: 'Com acesso' }, { key: 'convite', label: 'Convite enviado' }, { key: 'sem', label: 'Sem acesso' }];
const SEG = 'h-7 rounded-full px-3 text-[13px] font-semibold outline-none focus-visible:anel-foco';

// A lista do mockup A: filtros em pílulas (no endereço, pelo useScreenParams
// da tela), a busca pelo nome no estado da tela e uma linha por pessoa, toda
// ela um link para a ficha.
export function EquipeLista({ pessoas, filtros, setFiltros, busca, setBusca, hrefDe, modalities, leads, agora = new Date() }) {
  const visiveis = useMemo(() => filtrarEquipe(pessoas, filtros, busca), [pessoas, filtros, busca]);
  const ativos = (pessoas || []).filter((p) => !p.desligada).length;
  const desligados = (pessoas || []).length - ativos;
  const completas = visiveis.filter((p) => faltasDaFicha(p).faltam.length === 0).length;
  const porConsultor = useMemo(() => {
    const m = new Map();
    for (const l of leads || []) if (l.consultantId) m.set(l.consultantId, (m.get(l.consultantId) || 0) + 1);
    return m;
  }, [leads]);
  const porProfessor = useMemo(() => {
    const m = new Map();
    for (const l of leads || []) if (l.professorId && isClientLead(l)) m.set(l.professorId, (m.get(l.professorId) || 0) + 1);
    return m;
  }, [leads]);
  const pick = (campo) => (k) => setFiltros({ [campo]: k === TODOS ? null : k });

  const subDe = (p) => {
    if (p.funcao === 'professor') {
      const mods = professorModalityNames(p.professor, modalities).join(' e ');
      const n = porProfessor.get(p.professor?.id);
      return [mods, n ? `${n} ${n === 1 ? 'aluno' : 'alunos'}` : ''].filter(Boolean).join(', ');
    }
    const n = p.funcao === 'consultor' && p.user ? porConsultor.get(p.user.id) : 0;
    return n ? `${n} ${n === 1 ? 'lead' : 'leads'}` : '';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Situação" className="inline-flex rounded-full border border-border bg-card p-[3px]">
          {[['ativos', `Ativos ${ativos}`], ['desligados', `Desligados ${desligados}`]].map(([id, texto]) => (
            <button key={id} type="button" aria-pressed={filtros.situacao === id} onClick={() => setFiltros({ situacao: id })}
              className={cn(SEG, filtros.situacao === id ? 'bg-foreground text-background' : 'text-muted-foreground')}>
              {texto}
            </button>
          ))}
        </div>
        <FilterChip icon={Briefcase} label="Função" valueText={filtros.funcao ? FUNCAO_TEXTO[filtros.funcao] : 'Todas'} active={!!filtros.funcao}
          options={opcoes(FUNCOES_OPC, 'Todas as funções')} value={filtros.funcao ?? TODOS} onPick={pick('funcao')} />
        <FilterChip icon={Users} label="Vínculo" valueText={filtros.vinculo ? VINCULOS.find((v) => v.id === filtros.vinculo)?.label : 'Todos'} active={!!filtros.vinculo}
          options={opcoes(VINCULOS.map((v) => ({ key: v.id, label: v.label })), 'Todos os vínculos')} value={filtros.vinculo ?? TODOS} onPick={pick('vinculo')} />
        <FilterChip icon={Key} label="Acesso" valueText={filtros.acesso ? ACESSO_OPC.find((a) => a.key === filtros.acesso)?.label : 'Todos'} active={!!filtros.acesso}
          options={opcoes(ACESSO_OPC, 'Todos os acessos')} value={filtros.acesso ?? TODOS} onPick={pick('acesso')} />
        <label className="flex h-9 min-w-[200px] items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] focus-within:anel-foco">
          <Search size={14} aria-hidden="true" className="text-muted-foreground" />
          <span className="sr-only">Buscar pelo nome</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" autoComplete="off" className="w-full bg-transparent outline-none" />
        </label>
        <span className="ml-auto text-[12.5px] text-muted-foreground">
          {visiveis.length} {visiveis.length === 1 ? 'pessoa' : 'pessoas'}, {completas} com a ficha completa
        </span>
      </div>

      {/* shortcut: no celular a tabela rola de lado; um desenho próprio fica para quando o celular entrar */}
      <section className="overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-card shadow-card">
        <div className="min-w-[880px]">
          <div className="grid h-10 items-center gap-3 border-b border-border bg-muted/40 px-5 text-[12px] font-semibold text-muted-foreground" style={{ gridTemplateColumns: GRADE }}>
            <span>Pessoa</span><span>Função</span><span>Vínculo</span><span>Acesso ao app</span><span>Na equipe</span><span>Ficha</span>
          </div>
          {visiveis.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">Ninguém neste filtro.</p>
          ) : visiveis.map((p, i) => {
            const { total, faltam } = faltasDaFicha(p);
            const admissao = admissaoDe(p.ficha);
            // Quem saiu conta o tempo até o desligamento, não até hoje.
            const saiu = p.desligada ? periodoNaEquipe(p.ficha)?.ate : null;
            const tempo = admissao ? tempoDeCasa(admissao, saiu ? new Date(`${saiu}T12:00:00`) : agora) : '';
            const sub = subDe(p);
            return (
              <div key={p.id} className={cn('relative grid items-center gap-3 px-5 py-3 transition hover:bg-muted/50', i < visiveis.length - 1 && 'border-b border-border')}
                style={{ gridTemplateColumns: GRADE }}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <PessoaAvatar pessoa={p} />
                  <div className="min-w-0">
                    <AppLink to={hrefDe(p.id)} stretched draggable={false} aria-label={`Abrir a ficha de ${p.nome}`}
                      className="block truncate text-[13.5px] font-semibold outline-none focus-visible:after:anel-foco focus-visible:after:ring-inset">{p.nome}</AppLink>
                    <div className="truncate text-[11.5px] text-muted-foreground">{p.user?.email || p.ficha?.emailPessoal || p.ficha?.convite?.email || ''}</div>
                  </div>
                </div>
                <div className="min-w-0"><FuncaoSelo funcao={p.funcao} />{sub && <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{sub}</div>}</div>
                <div><VinculoSelo vinculo={p.ficha?.vinculo} /></div>
                <div><AcessoSelo acesso={p.acesso} textoDesligado={p.desligada ? desligadoEmTexto(p.ficha) : null} /></div>
                <div className="text-[12.5px]">
                  {!admissao ? <span className="text-muted-foreground">Sem admissão</span>
                    : tempo === 'desde hoje' && !saiu ? <div className="font-semibold">Na equipe desde hoje</div>
                      : (<><div className="font-semibold">{tempo}</div><div className="text-[11.5px] text-muted-foreground">
                        {saiu ? `${dataBR(admissao).slice(3)} a ${dataBR(saiu).slice(3)}` : `desde ${dataBR(admissao).slice(3)}`}
                      </div></>)}
                </div>
                <FichaAnel ok={total - faltam.length} total={total} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
