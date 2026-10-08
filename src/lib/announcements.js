// ============================================================================
// "NOVIDADES" — anúncios de feature (hardcoded).
// Feature nova = adiciona 1 entrada NO TOPO do array (id novo).
// Todas aparecem no SINO do header (lib/notifications.js), com histórico e
// marcação de lido; só as marcadas `major: true` interrompem com o pop-up
// (WhatsNewModal). Sem backend / sem função Vercel. Conteúdo product-wide.
// Em 08/10/2026 as novidades grandes antigas deixaram de abrir o pop-up e
// nenhuma entrada é `major` hoje. Tela nova se apresenta com o balão "Novo"
// dentro dela (components/NewFeatureBadge.jsx), e o sino guarda o histórico.
//   audience: 'todos'  → todos os papéis no sino; o pop-up (major) não abre
//                        para o professor (WhatsNewModal)
//   audience: 'gestor' → só o gestor vê
//   date               → 'YYYY-MM-DD', usado no "há X dias" do sino
//   major              → lançamento grande: além do sino, abre o pop-up
//   articleId          → artigo da Central de ajuda (lib/wiki.js) que explica
//   adminSteps         → passos "como configurar" (mostrados só p/ admin)
// ============================================================================
import { isGestor } from './acesso.js';

export const ANNOUNCEMENTS = [
  {
    id: 'rotinas-dos-consultores-2026-10',
    audience: 'gestor',
    date: '2026-10-07',
    eyebrow: 'Novidade',
    title: 'Rotinas: monte o dia de trabalho de cada consultor',
    summary:
      'Em Rotinas, no menu, você cria modelos com as tarefas do dia que não envolvem lead, como conferir a recepção ou postar o story da aula, e escolhe quem segue cada modelo. O consultor dá check na Meta diária, num cartão próprio, e a rotina não conta para o dia batido.',
  },
  {
    id: 'desfecho-e-indicacao-manual-2026-09',
    audience: 'todos',
    date: '2026-09-29',
    articleId: 'agendamentos',
    eyebrow: 'Novidade',
    title: 'Marcar desfecho na Meta e cadastrar indicações pela ficha',
    summary:
      'Na Meta Diária, visita e aula experimental agora têm o botão Marcar desfecho, que abre Compareceu e Não compareceu. Marcou errado? Clique no desfecho e troque: a pessoa volta para a etapa em que estava. O interruptor da Agenda de hoje e o gesto de segurar para desmarcar saíram. Na ficha do aluno, o botão Indicar ganhou Cadastrar indicação, para lançar os indicados um depois do outro.',
  },
  {
    id: 'esqueci-a-senha-2026-09',
    audience: 'todos',
    date: '2026-09-29',
    eyebrow: 'Novidade',
    title: 'Esqueceu a senha? Agora dá para criar outra sozinho',
    summary:
      'Na tela de entrada, clique em Esqueci a senha e digite o seu e-mail. Chega um código de 6 números, que vale por 15 minutos. Digite o código com a senha nova e entre com ela. Para o gestor: trocar a senha de quem saiu da academia não tira mais o acesso, porque a pessoa pode pedir um código. Para tirar o acesso, use Excluir acesso (o ícone de lixeira) em Configurações, Equipe & acessos.',
  },
  {
    id: 'upgrade-2026-09',
    audience: 'todos',
    date: '2026-09-09',
    articleId: 'upgrade',
    eyebrow: 'Novidade',
    title: 'Funil Upgrade: um plano melhor para quem já é cliente',
    summary:
      'Cliente não volta a ser lead, mas agora tem onde ser trabalhado: o funil Upgrade, no Pipeline. Coloque o cliente pela ficha, em Mudar fase, e trabalhe a esteira até fechar um plano maior. Venda abre o contrato como renovação; Perda tira do funil e a pessoa segue cliente.',
  },
  {
    id: 'troca-responsavel-2026-08',
    audience: 'todos',
    date: '2026-08-26',
    articleId: 'ficha',
    eyebrow: 'Novidade',
    title: 'Passar um lead para outro consultor',
    summary:
      'Agora não precisa mais chamar o gestor para trocar o responsável. Abra a ficha, clique no lápis, vá em Relacionamento e escolha o novo consultor. A troca fica registrada na linha do tempo e quem recebeu vê o aviso aqui no sino.',
  },
  {
    id: 'foto-cliente-2026-08',
    audience: 'todos',
    date: '2026-08-20',
    eyebrow: 'Novidade',
    title: 'Foto no perfil do aluno',
    summary:
      'Agora dá para colocar a foto de cada aluno. Na ficha, clique no ícone de câmera sobre o avatar e escolha uma imagem salva no aparelho ou tire na hora pela câmera. Antes de salvar, você ajusta o zoom e arrasta o rosto para o meio do círculo. A foto passa a aparecer na ficha, na lista de clientes e na busca do topo.',
  },
  {
    id: 'vencidos-2026-08',
    audience: 'todos',
    date: '2026-08-18',
    articleId: 'vencidos',
    eyebrow: 'Novidade',
    title: 'Vencidos entram na Meta Diária',
    summary:
      'Cliente que deixou o contrato vencer volta na lista todo dia, pelo prazo que a academia definir. Antes ele sumia da rotina no dia seguinte ao vencimento.',
  },
  {
    id: 'indicacoes-2026-08',
    audience: 'todos',
    date: '2026-08-09',
    articleId: 'indicacoes',
    eyebrow: 'Novidade',
    title: 'Sistema de indicações no ar',
    summary:
      'Agora dá para registrar quem indicou cada lead e acompanhar o que aconteceu com o convite. Cada aluno também tem um link próprio para chamar amigos, e quem se cadastra por ele já entra vinculado, no seu nome.',
    points: [
      'No cadastro de lead, ligue "É uma indicação?" e escolha o aluno que indicou.',
      'A ficha do aluno ganhou a aba Indicações, com quem ele trouxe e quantos viraram alunos.',
      'Quando o indicado fecha matrícula, o aviso aparece na linha do tempo de quem indicou.',
    ],
  },
  {
    id: 'meta-prospeccao-2026-06',
    audience: 'todos',
    date: '2026-06-20',
    articleId: 'meta-diaria',
    eyebrow: 'Novidade',
    title: 'Meta de Prospecção + novo Painel da Equipe',
    summary:
      'Agora, além da meta diária de tarefas, cada consultor tem um piso de prospecção: um mínimo de ações por dia. Conta agendar visita ou aula, registrar ligação ou mensagem, e cadastrar lead novo. Quem zera as tarefas e ainda bate a prospecção ganha o selo Dia perfeito ⚡.',
    points: [
      'O Painel da Equipe virou uma tabela executiva com as duas metas (diária e prospecção) lado a lado.',
      'Gráfico "Trajetória do mês" clicável: clique num dia para ver os resultados daquele dia.',
      'O gestor também pode entrar na meta de prospecção (opcional).',
    ],
  },
];

const SEEN_KEY = (uid) => `stronix_seen_announcements_${uid || 'anon'}`;

function readSeen(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')); }
  catch { return new Set(); }
}

// Ids já vistos por este usuário — o sino usa para marcar o que é novo.
export function seenAnnouncementIds(appUser) {
  return [...readSeen(appUser?.id)];
}

// O anúncio GRANDE mais recente que serve ao público do usuário e que ele ainda
// não viu. null = nada a interromper. As novidades menores não passam por aqui:
// vivem só no sino, sem pop-up.
export function latestUnseenAnnouncement(appUser) {
  if (!appUser?.id) return null;
  const isAdmin = isGestor(appUser);
  const seen = readSeen(appUser.id);
  return ANNOUNCEMENTS.find(a =>
    a.major === true && !seen.has(a.id) && (a.audience === 'todos' || (a.audience === 'gestor' && isAdmin))
  ) || null;
}

export function markAnnouncementSeen(appUser, id) {
  if (!appUser?.id || !id) return;
  try {
    const seen = readSeen(appUser.id);
    seen.add(id);
    localStorage.setItem(SEEN_KEY(appUser.id), JSON.stringify([...seen]));
  } catch { /* localStorage indisponível — ignora (mostra de novo no próximo load) */ }
}
