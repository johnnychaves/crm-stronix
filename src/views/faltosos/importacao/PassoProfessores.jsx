import { isActiveProfessor } from '../../../lib/teamRoles.js';
import { SEM_PROFESSOR } from '../../../lib/faltosos/passosImportacao.js';

// Passo 2 da importação, só quando o Faltantes traz nome de professor que
// ainda não tem ligação. A sugestão do plano já vem escolhida; sem sugestão,
// o gestor escolhe, e o Continuar espera todos. A escolha só é gravada no
// Confirmar, junto com o resto, e vale nas próximas importações. Select
// nativo, como nos formulários em diálogo de Equipe & acessos.

const CAMPO = 'h-10 w-full rounded-[10px] border border-border bg-card px-3 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30';

export function PassoProfessores({ novos, escolhas, professores, onEscolher }) {
  const ativos = (professores || [])
    .filter((p) => p?.id && isActiveProfessor(p))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-muted-foreground">
        Esses nomes aparecem no Faltantes pela primeira vez. Diga quem é cada um no cadastro de professores. A escolha fica guardada para as próximas importações.
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {novos.map((n) => {
          const sugerido = Boolean(n.sugestao) && escolhas?.[n.nome] === n.sugestao;
          return (
            <li key={n.nome} className="grid gap-2 px-4 py-3 sm:grid-cols-2 sm:items-center">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{n.nome}</div>
                <div className="num text-[11.5px] text-muted-foreground">
                  {n.alunos === 1 ? '1 aluno' : `${n.alunos} alunos`} no Faltantes{sugerido ? ' · sugerido pelo nome' : ''}
                </div>
              </div>
              <select
                aria-label={`Professor do cadastro para ${n.nome}`}
                value={escolhas?.[n.nome] || ''}
                onChange={(e) => onEscolher(n.nome, e.target.value)}
                className={CAMPO}
              >
                <option value="" disabled>Escolha o professor</option>
                {ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                <option value={SEM_PROFESSOR}>Sem professor (fica com o gestor)</option>
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
