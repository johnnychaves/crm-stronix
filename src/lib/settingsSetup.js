// Progresso de setup e pendências da Visão geral (Configurações).
//
// Nada aqui é armazenado: os 9 passos e as pendências saem das MESMAS checagens
// sobre os dados que a academia já tem. Um passo concluído nunca vira pendência
// e vice-versa — é a mesma função booleana lida de dois ângulos.
//
// Sem JSX de propósito: a UI recebe só dados (rótulo, nome do ícone, destino),
// o que mantém a regra testável sem montar componente.

// Passos na ordem em que aparecem no rodapé do card de progresso.
const STEP_ORDER = [
  'funnel', 'sources', 'modalities', 'plans', 'loss',
  'metaDays', 'sla', 'access', 'prospect',
];

const STEP_LABELS = {
  funnel: 'Funil criado',
  sources: 'Origens',
  modalities: 'Modalidades',
  plans: 'Planos',
  loss: 'Motivos de perda',
  metaDays: 'Meta diária',
  sla: 'SLA crítico',
  access: 'Acessos da equipe',
  prospect: 'Meta de prospecção',
};

const len = (arr) => (Array.isArray(arr) ? arr.length : 0);
const list = (arr) => (Array.isArray(arr) ? arr : []);
const isManager = (u) => u?.role === 'admin';

// Consultor sem piso de prospecção: campo vazio, 0 ou negativo = sem meta.
const hasProspectTarget = (u) => Number(u?.dailyVolumeTarget) > 0;

/**
 * Estado de setup da academia.
 *
 * @returns {{steps: Array, doneCount: number, total: number, percent: number,
 *            pendings: Array, attention: Object}}
 *   `attention` mapeia seção → texto curto, pro ponto âmbar do trilho.
 */
function buildSetupState({
  funnels, statuses, sources, modalities, planos, lossReasons,
  metaWeekdays, slaOverdueDays, usersList,
}) {
  const users = list(usersList);
  const consultants = users.filter(u => !isManager(u));
  const usersWithoutAccess = users.filter(u => !String(u?.authUid || '').trim());
  const consultantsWithoutTarget = consultants.filter(u => !hasProspectTarget(u));

  // Funil "raso": Kanban de uma coluna só não desenha caminho nenhum.
  const thinFunnels = list(funnels).filter(f => {
    const stages = list(statuses).filter(s => s.funnelId === f.id);
    return stages.length < 2;
  });

  const done = {
    funnel: len(funnels) > 0,
    sources: len(sources) > 0,
    modalities: len(modalities) > 0,
    plans: len(planos) > 0,
    loss: len(lossReasons) > 0,
    metaDays: len(metaWeekdays) > 0,
    sla: Number(slaOverdueDays) >= 1,
    // Sem equipe cadastrada o passo não está concluído — é o cadastro que falta.
    access: users.length > 0 && usersWithoutAccess.length === 0,
    // Sem consultor cadastrado ainda não há piso de prospecção a definir.
    prospect: consultants.length > 0 && consultantsWithoutTarget.length === 0,
  };

  const steps = STEP_ORDER.map(id => ({ id, label: STEP_LABELS[id], done: done[id] }));
  const doneCount = steps.filter(s => s.done).length;
  const total = steps.length;

  const pendings = [];

  if (!done.access && usersWithoutAccess.length > 0) {
    const [first] = usersWithoutAccess;
    const many = usersWithoutAccess.length > 1;
    pendings.push({
      id: 'access',
      tone: 'amber',
      icon: 'user-x',
      title: many
        ? `${usersWithoutAccess.length} membros da equipe estão sem acesso vinculado`
        : `${first.name || 'Um membro da equipe'} está sem acesso vinculado`,
      description: many
        ? 'Eles aparecem nos relatórios, mas não conseguem entrar no app. Defina uma senha ou reenvie o convite.'
        : 'Aparece nos relatórios, mas não consegue entrar no app. Defina uma senha ou reenvie o convite.',
      actionLabel: 'Resolver',
      actionKind: 'primary',
      section: 'team',
      focusId: first.id,
    });
  }

  if (!done.prospect && consultantsWithoutTarget.length > 0) {
    const n = consultantsWithoutTarget.length;
    pendings.push({
      id: 'prospect',
      tone: 'amber',
      icon: 'zap-off',
      title: `${n} ${n === 1 ? 'consultor sem meta' : 'consultores sem meta'} de prospecção`,
      description: 'Sem piso de ações por dia eles nunca disputam o selo de dia perfeito.',
      actionLabel: 'Definir alvos',
      actionKind: 'secondary',
      section: 'pace',
    });
  }

  if (!done.funnel) {
    pendings.push({
      id: 'funnel',
      tone: 'amber',
      icon: 'kanban',
      title: 'Nenhum funil configurado',
      description: 'O Kanban precisa de pelo menos um funil para mostrar os leads em alguma coluna.',
      actionLabel: 'Criar funil',
      actionKind: 'secondary',
      section: 'funnels',
    });
  }

  thinFunnels.forEach(f => {
    const stages = list(statuses).filter(s => s.funnelId === f.id);
    pendings.push({
      id: `thin-funnel:${f.id}`,
      tone: 'neutral',
      icon: 'kanban',
      title: stages.length === 1
        ? `O funil "${f.name}" tem só a etapa ${stages[0].name}`
        : `O funil "${f.name}" não tem nenhuma etapa`,
      description: stages.length === 1
        ? 'Com uma etapa só, o Kanban desse funil vira uma coluna — vale desenhar o caminho.'
        : 'Sem etapas, esse funil não abre no Kanban.',
      actionLabel: 'Abrir funil',
      actionKind: 'secondary',
      section: 'funnels',
      focusId: f.id,
    });
  });

  if (!done.sources) {
    pendings.push({
      id: 'sources',
      tone: 'neutral',
      icon: 'filter',
      title: 'Nenhuma origem cadastrada',
      description: 'Os leads entram sem canal e o Gerencial não consegue dizer de onde veio a venda.',
      actionLabel: 'Cadastrar origem',
      actionKind: 'secondary',
      section: 'catalogs',
      focusId: 'sources',
    });
  }

  if (!done.loss) {
    pendings.push({
      id: 'loss',
      tone: 'neutral',
      icon: 'thumbs-down',
      title: 'Nenhum motivo de perda cadastrado',
      description: 'Os descartes ficam sem justificativa e o relatório de perdas fica cego.',
      actionLabel: 'Cadastrar motivo',
      actionKind: 'secondary',
      section: 'catalogs',
      focusId: 'loss',
    });
  }

  if (!done.modalities) {
    pendings.push({
      id: 'modalities',
      tone: 'neutral',
      icon: 'dumbbell',
      title: 'Nenhuma modalidade cadastrada',
      description: 'Sem modalidade o consultor não consegue dizer o que foi agendado.',
      actionLabel: 'Cadastrar modalidade',
      actionKind: 'secondary',
      section: 'sched',
    });
  }

  if (!done.plans) {
    pendings.push({
      id: 'plans',
      tone: 'neutral',
      icon: 'dollar-sign',
      title: 'Nenhum plano cadastrado',
      description: 'Na matrícula não há o que escolher — o contrato do cliente fica sem plano.',
      actionLabel: 'Cadastrar plano',
      actionKind: 'secondary',
      section: 'catalogs',
      focusId: 'plans',
    });
  }

  // Ponto âmbar do trilho: a primeira pendência de cada seção vira o tooltip.
  const attention = {};
  pendings.forEach(p => { if (!attention[p.section]) attention[p.section] = p.title; });
  if (pendings.length > 0) {
    attention.overview = `${pendings.length} ${pendings.length === 1 ? 'item pedindo atenção' : 'itens pedindo atenção'}`;
  }

  return {
    steps,
    doneCount,
    total,
    percent: Math.round((doneCount / total) * 100),
    pendings,
    attention,
  };
}

export { buildSetupState, STEP_ORDER, STEP_LABELS };
