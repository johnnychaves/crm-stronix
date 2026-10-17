// Progresso de setup e pendências da Visão geral (Configurações).
//
// Nada aqui é armazenado: os 7 passos e as pendências saem das MESMAS checagens
// sobre os dados que a academia já tem. Um passo concluído nunca vira pendência
// e vice-versa — é a mesma função booleana lida de dois ângulos.
//
// Dias de meta e alerta de lead atrasado não são passos: o sistema já nasce com
// um valor para os dois, então "concluir" os dois não diz nada. Eles aparecem em
// `values`, só com o valor de agora.
//
// Limite conhecido: o passo Acessos da equipe fecha quando todo cadastro tem
// login, e o gestor que criou a academia já entra com o dele. Uma academia só
// com o gestor cadastrado fecha o passo sem ter equipe nenhuma.
//
// Sem JSX de propósito: a UI recebe só dados (rótulo, nome do ícone, destino),
// o que mantém a regra testável sem montar componente.

import { roleOf, ROLES } from './acesso.js';
import { leadFunnelsOf } from './crm/scope.js';
import { getDefaultFunnel, isItemInFunnel } from './funnels.js';
import { daysText } from './rotinas.js';
import { SETTINGS_RAIL_GROUPS } from './settingsRail.js';

// Passos na ordem em que a lista de prontos os mostra.
const STEP_ORDER = [
  'funnel', 'sources', 'modalities', 'plans', 'loss', 'access', 'prospect',
];

const STEP_LABELS = {
  funnel: 'Funil criado',
  sources: 'Origens',
  modalities: 'Modalidades',
  plans: 'Planos',
  loss: 'Motivos de perda',
  access: 'Acessos da equipe',
  prospect: 'Meta de prospecção',
};

const len = (arr) => (Array.isArray(arr) ? arr.length : 0);
const list = (arr) => (Array.isArray(arr) ? arr : []);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Consultor sem piso de prospecção: campo vazio, 0 ou negativo = sem meta.
const hasProspectTarget = (u) => Number(u?.dailyVolumeTarget) > 0;

// "A", "A e B", "A, B e C" e, passando de três, "A, B, C e mais N".
function namesText(names) {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} e mais ${rest}`;
  if (shown.length < 2) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
}

// Os funis com menos de duas etapas viram UMA pendência. Um Kanban de uma
// coluna só não desenha caminho nenhum, e quatro linhas iguais escondiam o que
// mais importa. `thin` traz { name, stages } de cada funil raso.
function thinFunnelsPending(thin) {
  const n = thin.length;
  const empty = thin.filter(t => t.stages === 0).length;
  const names = namesText(thin.map(t => t.name || 'Sem nome'));
  let title;
  if (empty === n) title = `${plural(n, 'funil', 'funis')} sem etapa`;
  else if (empty === 0) title = `${n} ${n === 1 ? 'funil com só uma etapa' : 'funis com só uma etapa'}`;
  else title = `${plural(n, 'funil', 'funis')} com menos de duas etapas`;
  return {
    id: 'thin-funnels',
    tone: 'neutral',
    icon: 'kanban',
    count: n,
    title,
    description: empty === n
      ? `${names} ${n === 1 ? 'não abre' : 'não abrem'} no Pipeline.`
      : `${names} ${n === 1 ? 'precisa' : 'precisam'} de pelo menos duas etapas para desenhar o caminho no Pipeline.`,
    actionLabel: n === 1 ? 'Abrir funil' : 'Abrir funis',
    actionKind: 'secondary',
    section: 'funnels',
  };
}

/**
 * Estado de setup da academia.
 *
 * @returns {{steps: Array, doneCount: number, total: number, percent: number,
 *            pendings: Array, counts: Object, values: Array}}
 *   `counts` mapeia seção → quantos itens dela pedem ação (a soma do `count` de
 *   cada pendência), que vira o número do item no trilho. `values` é o bloco
 *   "Valores atuais" da Visão geral.
 */
function buildSetupState({
  funnels, statuses, sources, modalities, planos, lossReasons,
  metaWeekdays, slaOverdueDays, usersList,
}) {
  const users = list(usersList);
  // Prospecção é do consultor. O gestor tem meta à parte e o professor não
  // prospecta. Cadastro sem papel conta como consultor (roleOf).
  const consultants = users.filter(u => roleOf(u) === ROLES.CONSULTOR);
  const usersWithoutAccess = users.filter(u => !String(u?.authUid || '').trim());
  const consultantsWithoutTarget = consultants.filter(u => !hasProspectTarget(u));

  // Os funis de clientes (Renovações, Vencidos e Upgrade) são do sistema: o
  // de Renovações nem guarda etapa no banco, porque as colunas saem dos marcos
  // (src/lib/renewalFunnel.js). Contar com eles deixaria toda academia com uma
  // pendência que o gestor não tem como resolver.
  const leadFunnels = leadFunnelsOf(funnels);

  // Funil "raso": Kanban de uma coluna só não desenha caminho nenhum. Etapa
  // sem funnelId é do funil padrão, como no Kanban (isItemInFunnel).
  const defaultFunnelId = getDefaultFunnel(list(funnels))?.id || null;
  const thinFunnels = leadFunnels
    .map(f => ({ id: f.id, name: f.name, stages: list(statuses).filter(s => isItemInFunnel(s, f.id, defaultFunnelId)).length }))
    .filter(f => f.stages < 2);

  const done = {
    funnel: leadFunnels.length > 0,
    sources: len(sources) > 0,
    modalities: len(modalities) > 0,
    plans: len(planos) > 0,
    loss: len(lossReasons) > 0,
    // Sem equipe cadastrada o passo não está concluído — é o cadastro que falta.
    access: users.length > 0 && usersWithoutAccess.length === 0,
    // Sem consultor cadastrado ainda não há piso de prospecção a definir.
    prospect: consultants.length > 0 && consultantsWithoutTarget.length === 0,
  };

  const steps = STEP_ORDER.map(id => ({ id, label: STEP_LABELS[id], done: done[id] }));
  const doneCount = steps.filter(s => s.done).length;
  const total = steps.length;

  // Toda pendência diz quantos itens ela representa (`count`, 1 por padrão).
  const pendings = [];
  const add = (p) => pendings.push({ count: 1, ...p });

  if (!done.access && usersWithoutAccess.length > 0) {
    const [first] = usersWithoutAccess;
    const many = usersWithoutAccess.length > 1;
    add({
      id: 'access',
      tone: 'amber',
      icon: 'user-x',
      count: usersWithoutAccess.length,
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
    add({
      id: 'prospect',
      tone: 'amber',
      icon: 'zap-off',
      count: n,
      title: `${n} ${n === 1 ? 'consultor sem meta' : 'consultores sem meta'} de prospecção`,
      description: 'Sem piso de ações por dia eles nunca disputam o selo de dia perfeito.',
      actionLabel: 'Definir alvos',
      actionKind: 'secondary',
      section: 'pace',
    });
  }

  // Passo aberto que as pendências acima não cobrem: sem ninguém na equipe não
  // há acesso a vincular, e sem consultor não há meta de prospecção a definir.
  // Sem estas linhas o passo ficava fora de "O que falta" e a Visão geral dizia
  // "6 de 7" sem dizer o que falta.
  if (!done.access && users.length === 0) {
    add({
      id: 'no-team',
      tone: 'amber',
      icon: 'user-plus',
      title: 'Ninguém cadastrado na equipe',
      description: 'Cadastre quem vai usar o app para a equipe entrar e receber os leads.',
      actionLabel: 'Cadastrar pessoa',
      actionKind: 'primary',
      section: 'team',
      focusId: 'new',
    });
  } else if (!done.prospect && consultants.length === 0) {
    add({
      id: 'no-consultant',
      tone: 'neutral',
      icon: 'user-plus',
      title: 'Nenhum consultor cadastrado',
      description: 'A meta de prospecção é de cada consultor. Cadastre quem vende para definir as metas.',
      actionLabel: 'Cadastrar consultor',
      actionKind: 'secondary',
      section: 'team',
      focusId: 'new',
    });
  }

  if (!done.funnel) {
    add({
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

  if (thinFunnels.length > 0) {
    add({ ...thinFunnelsPending(thinFunnels), focusId: thinFunnels[0].id });
  }

  if (!done.sources) {
    add({
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
    add({
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
    add({
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
    add({
      id: 'plans',
      tone: 'neutral',
      icon: 'dollar-sign',
      title: 'Nenhum plano cadastrado',
      description: 'Na matrícula não há o que escolher, e o contrato do cliente fica sem plano.',
      actionLabel: 'Cadastrar plano',
      actionKind: 'secondary',
      section: 'catalogs',
      focusId: 'plans',
    });
  }

  // Número do item no trilho: quantos itens da seção pedem ação.
  const counts = {};
  pendings.forEach(p => { counts[p.section] = (counts[p.section] || 0) + p.count; });

  // O sistema não sabe se o valor é o de fábrica ou foi escolhido, então só diz
  // o valor de agora.
  const sla = Number(slaOverdueDays);
  const values = [
    { id: 'metaDays', label: 'Dias de meta', value: daysText(metaWeekdays).toLowerCase() || 'nenhum dia', section: 'pace' },
    { id: 'sla', label: 'Alerta de lead atrasado', value: sla >= 1 ? plural(sla, 'dia', 'dias') : 'não definido', section: 'pace' },
  ];

  return {
    steps,
    doneCount,
    total,
    percent: Math.round((doneCount / total) * 100),
    pendings,
    counts,
    values,
  };
}

// Os números do trilho: os da pendência de cada seção mais as indicações sem
// dono, que a view conta à parte (vêm dos leads, não do setup).
function railCounts(setup, pendingOwners = 0) {
  return pendingOwners > 0 ? { ...setup.counts, 'referral-owners': pendingOwners } : setup.counts;
}

/**
 * O resumo de cada grupo do trilho e se o grupo pede ação (âmbar e semibold).
 * Fica aqui, ao lado da conta das pendências, para o texto e a regra andarem
 * juntos. Pendência de Agendamento ou de catálogo vazio não tem frase própria:
 * o grupo mostra o número no item e a frase de quando está tudo certo.
 *
 * @returns {Object<string, {text: string, pede: boolean}>} por id de grupo
 */
function railSummaries(setup, { teamSize = 0, funnelCount = 0, catalogTotal = 0, pendingOwners = 0 } = {}) {
  const counts = railCounts(setup, pendingOwners);
  const pending = (id) => setup.pendings.find(p => p.id === id);
  const noAccess = pending('access')?.count || 0;
  const noTarget = pending('prospect')?.count || 0;
  const thin = pending('thin-funnels');
  const people = plural(teamSize, 'pessoa', 'pessoas');

  const text = {
    academia: 'Perfil e plano',
    equipe: noAccess === 0
      ? people
      : (noAccess === teamSize ? `${people} sem acesso` : `${people}, ${noAccess} sem acesso`),
    dia: noTarget > 0 ? `${plural(noTarget, 'consultor', 'consultores')} sem meta` : 'Metas, agenda e rotinas',
    funil: thin ? thin.title : `${plural(funnelCount, 'funil', 'funis')}, ${plural(catalogTotal, 'item', 'itens')} nos catálogos`,
    conexoes: 'Stronizap',
    base: pendingOwners > 0 ? `${plural(pendingOwners, 'indicação', 'indicações')} sem dono` : 'Migração e importação',
  };

  const out = {};
  SETTINGS_RAIL_GROUPS.forEach(g => {
    if (text[g.id] == null) return;
    out[g.id] = { text: text[g.id], pede: g.items.some(i => counts[i.id] > 0) };
  });
  return out;
}

export { buildSetupState, railCounts, railSummaries, STEP_ORDER, STEP_LABELS };
