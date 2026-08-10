// ============================================================================
// CENTRAL DE AJUDA — o conteúdo da wiki do Stronilead.
// Mora no código (versionado, sem backend). Artigo novo = 1 entrada aqui.
//
// Cada artigo é uma lista de BLOCOS, não markdown: o renderer conhece cada tipo
// e cuida do estilo, então o texto nunca sai do padrão visual do app.
//   { t: 'p',     text }                        parágrafo
//   { t: 'steps', items: [] }                   passo a passo numerado
//   { t: 'tip',   text }                        caixa de dica (laranja)
//   { t: 'warn',  text }                        caixa de atenção
//   { t: 'demo',  name, caption }               demonstração animada em código
//                                               (components/help/WikiDemo.jsx)
//   { t: 'media', src, alt, caption }           GIF ou vídeo gravado da tela.
//                                               Ponha o arquivo em public/ajuda/
//                                               e use src: '/ajuda/nome.gif'.
//
// Sobre GIF: o bloco `media` já está pronto para receber gravações reais da
// plataforma. Enquanto elas não existem, os blocos `demo` reproduzem a mesma
// interação em animação de código — pesam zero, ficam nítidas em qualquer tela
// e acompanham o tema claro/escuro.
// ============================================================================

import { normalize } from './globalSearch.js';

export const BLOCK_KINDS = ['p', 'steps', 'tip', 'warn', 'demo', 'media'];

export const WIKI_CATEGORIES = [
  { id: 'inicio', label: 'Primeiros passos' },
  { id: 'dia', label: 'Rotina do dia' },
  { id: 'fechamento', label: 'Fechamento' },
  { id: 'indicacoes', label: 'Indicações' },
  { id: 'config', label: 'Configurações' },
];

export const WIKI_ARTICLES = [
  // ---------------------------------------------------------------- início --
  {
    id: 'pipeline',
    category: 'inicio',
    title: 'Como o pipeline funciona',
    summary: 'As colunas do Kanban, o que cada uma significa e como mover uma pessoa.',
    blocks: [
      { t: 'p', text: 'O Pipeline é o quadro onde cada pessoa aparece como um card. As colunas são as etapas do seu funil, e a posição do card diz em que ponto da conversa aquela pessoa está.' },
      { t: 'demo', name: 'pipeline', caption: 'Arraste o card para mudar a etapa.' },
      { t: 'p', text: 'Toda academia tem três colunas fixas. Negociação é a reta final, Venda guarda as matrículas do mês e Perda recebe quem desistiu, sempre com um motivo. As etapas do meio você configura como quiser.' },
      { t: 'steps', items: [
        'Arraste o card para a coluna nova, ou abra a ficha e use "Mudar fase".',
        'Ao soltar em Venda, o sistema pede o plano e o valor para registrar o contrato.',
        'Ao soltar em Perda, ele pergunta o motivo. Esse motivo vira relatório depois.',
      ] },
      { t: 'tip', text: 'O card mostra há quantos dias a pessoa está sem contato. Quando esse número cresce, ela precisa de atenção antes de esfriar.' },
    ],
  },
  {
    id: 'cadastrar-lead',
    category: 'inicio',
    title: 'Cadastrando um lead',
    summary: 'O que é obrigatório, o que ajuda depois e como o sistema evita cadastro repetido.',
    blocks: [
      { t: 'p', text: 'O botão "Cadastrar lead" fica no topo de qualquer tela. Nome, WhatsApp e a dor da pessoa são obrigatórios. O resto você completa quando souber.' },
      { t: 'demo', name: 'novo-lead', caption: 'Cadastro com verificação de WhatsApp repetido.' },
      { t: 'steps', items: [
        'Digite o nome e o WhatsApp com DDD.',
        'Escolha de onde a pessoa veio. Se foi indicação de um aluno, ligue o interruptor "É uma indicação?".',
        'Diga em que funil e etapa ela entra. O padrão já vem escolhido.',
        'Registre a dor, ou seja, o que a pessoa quer resolver. É o que o consultor usa no primeiro contato.',
      ] },
      { t: 'warn', text: 'Se o WhatsApp já existir na base, o cadastro é bloqueado e o sistema mostra quem é a pessoa e quem está responsável. Isso evita dois consultores trabalhando o mesmo contato.' },
    ],
  },
  {
    id: 'ficha',
    category: 'inicio',
    title: 'A ficha da pessoa',
    summary: 'Linha do tempo, dados de CRM, contratos e indicações num lugar só.',
    blocks: [
      { t: 'p', text: 'Clicar em qualquer card abre a ficha. O topo mostra o estado atual, o responsável e o próximo passo agendado. Abaixo ficam as abas.' },
      { t: 'demo', name: 'ficha', caption: 'As abas da ficha.' },
      { t: 'steps', items: [
        'Linha do tempo: tudo que aconteceu, com filtros por conversas, agendamentos, anotações e marcos.',
        'CRM: dados cadastrais, etiquetas e responsável.',
        'Contratos: plano vigente, histórico e as ações de renovar, trancar ou cancelar.',
        'Indicações: aparece só para alunos, com quem a pessoa trouxe e o link dela.',
      ] },
      { t: 'tip', text: 'Anotação importante pode ser fixada. Ela sobe para o topo da linha do tempo e não se perde no histórico.' },
    ],
  },
  // ------------------------------------------------------------------- dia --
  {
    id: 'meta-diaria',
    category: 'dia',
    title: 'Meta diária',
    summary: 'A lista de tarefas do dia, como ela é montada e o que conta como prospecção.',
    blocks: [
      { t: 'p', text: 'A Meta Diária monta sozinha a lista do dia de cada consultor. Ela junta quem precisa de retorno, quem está atrasado, as visitas e aulas de hoje e os clientes na janela de renovação.' },
      { t: 'demo', name: 'meta', caption: 'Concluir uma tarefa da meta.' },
      { t: 'p', text: 'Cada tarefa concluída sai da lista. O que fica é exatamente o que ainda precisa de você hoje.' },
      { t: 'steps', items: [
        'Abra a tarefa e registre o que aconteceu na conversa.',
        'Se a pessoa pediu para falar depois, reagende. Ela volta na data escolhida.',
        'Se virou visita ou aula, agende pelo próprio card.',
      ] },
      { t: 'tip', text: 'Além das tarefas, existe o piso de prospecção: um mínimo de ações novas por dia. Quem zera as tarefas e bate a prospecção ganha o selo Dia perfeito.' },
    ],
  },
  {
    id: 'agendamentos',
    category: 'dia',
    title: 'Visitas e aulas experimentais',
    summary: 'Como agendar, como registrar o comparecimento e o que acontece depois.',
    blocks: [
      { t: 'p', text: 'Visita é a pessoa conhecendo a academia. Aula experimental é ela treinando com um professor. As duas são agendadas pela ficha ou pela Meta Diária.' },
      { t: 'steps', items: [
        'Escolha o tipo, a data e a hora. Na aula, escolha também o professor e a modalidade.',
        'No dia, registre o desfecho: compareceu, não veio, remarcou ou cancelou.',
        'Quem compareceu avança sozinho para Negociação, porque a conversa mudou de estágio.',
      ] },
      { t: 'warn', text: 'Registrar o desfecho é o que alimenta a taxa de comparecimento e a conversão por professor. Agendamento sem desfecho fica no limbo e some dos relatórios.' },
    ],
  },
  // ------------------------------------------------------------ fechamento --
  {
    id: 'matricula',
    category: 'fechamento',
    title: 'Matrícula e contrato',
    summary: 'O que o sistema grava quando a pessoa fecha e como corrigir depois.',
    blocks: [
      { t: 'p', text: 'Mover para Venda abre a tela de matrícula. Você escolhe o plano, confere o valor e define quando a vigência começa. O sistema calcula o fim a partir da duração do plano.' },
      { t: 'steps', items: [
        'Escolha o plano. O valor vem preenchido e aceita desconto com motivo.',
        'Confirme o início da vigência. Ele não precisa ser hoje.',
        'Ao salvar, a pessoa vira cliente e o contrato aparece na aba Contratos.',
      ] },
      { t: 'tip', text: 'Errou algum dado? A aba Contratos tem a correção do contrato vigente, sem precisar refazer a matrícula.' },
    ],
  },
  {
    id: 'renovacao',
    category: 'fechamento',
    title: 'Renovação por marcos',
    summary: 'Quando o cliente entra na sua meta e como registrar a decisão dele.',
    blocks: [
      { t: 'p', text: 'O cliente entra na Meta Diária de renovação nos marcos configurados pela academia, por padrão 90, 60 e 30 dias antes do contrato vencer. Cada marco é uma conversa.' },
      { t: 'steps', items: [
        'Abra a tarefa de renovação e converse com o aluno.',
        'Renovou: registre o plano novo. O contrato anterior vira histórico e a vigência emenda na data certa.',
        'Não vai renovar agora: registre o desfecho. Ele sai da meta sem sumir do radar.',
      ] },
      { t: 'warn', text: 'Renovação não recarimba a data de conversão. A matrícula continua contando no mês em que aconteceu de verdade.' },
    ],
  },
  // ------------------------------------------------------------- indicações --
  {
    id: 'indicacoes',
    category: 'indicacoes',
    title: 'Como funcionam as indicações',
    summary: 'Registrar quem indicou, acompanhar o convite e ver quem virou aluno.',
    blocks: [
      { t: 'p', text: 'Toda indicação fica ligada ao aluno que trouxe a pessoa. É assim que você descobre quem são seus melhores divulgadores e o que aconteceu com cada convite.' },
      { t: 'demo', name: 'indicacao-switch', caption: 'Cadastro de lead com indicação.' },
      { t: 'steps', items: [
        'No cadastro do lead, ligue "É uma indicação?" e busque o aluno que indicou. Só quem já é aluno aparece na busca.',
        'O lead entra no funil Indicações, na etapa Aguardando ação, e o consultor responsável é o mesmo do aluno.',
        'Na ficha do aluno, a aba Indicações mostra quantos ele trouxe, quantos viraram alunos e quantos se perderam.',
      ] },
      { t: 'p', text: 'Quando um indicado fecha matrícula, o aviso entra na linha do tempo de quem indicou. Fica registrado para sempre que aquele aluno trouxe um cliente novo.' },
      { t: 'tip', text: 'Lead antigo que veio por indicação e ficou sem vínculo? Em Configurações, Pessoas, a ferramenta "Indicações sem dono" resolve a fila de uma vez.' },
    ],
  },
  {
    id: 'link-indicacao',
    category: 'indicacoes',
    title: 'O link de cada cliente',
    summary: 'O aluno convida sozinho e o lead já entra vinculado no seu nome.',
    blocks: [
      { t: 'p', text: 'Cada aluno tem um link próprio. Quem abrir vê a marca da academia e o nome de quem convidou, preenche nome e WhatsApp, e vira lead na hora.' },
      { t: 'demo', name: 'indicacao-link', caption: 'Copiar o link e mandar para o aluno.' },
      { t: 'steps', items: [
        'Abra a ficha do aluno e vá na aba Indicações.',
        'Use Copiar, ou Enviar pro cliente, que abre o WhatsApp dele com a mensagem pronta.',
        'O aluno repassa o link para os amigos.',
      ] },
      { t: 'p', text: 'Quem se cadastra pelo link entra no funil Indicações já vinculado ao aluno, com o mesmo consultor responsável. Você recebe o aviso no sino do topo.' },
      { t: 'warn', text: 'Se a pessoa já tiver cadastro na base, o sistema não duplica. Ela vê a mesma mensagem de sucesso e fica um registro na ficha existente para a equipe decidir o que fazer.' },
    ],
  },
  // ---------------------------------------------------------------- config --
  {
    id: 'configuracoes',
    category: 'config',
    title: 'O que configurar primeiro',
    summary: 'A ordem que faz o sistema funcionar redondo desde o primeiro dia.',
    blocks: [
      { t: 'p', text: 'Configurações tem sete destinos. A Visão geral mostra o que ainda falta preencher, em ordem de importância.' },
      { t: 'steps', items: [
        'Pessoas: cadastre a equipe e defina quem é administrador.',
        'Funis e etapas: desenhe as colunas do Pipeline do jeito que sua operação fala.',
        'Catálogos: origens, motivos de perda, dores, etiquetas e planos.',
        'Ritmo: meta diária, piso de prospecção e turnos de cada consultor.',
        'Agendamentos: modalidades, professores e quantidade de aulas experimentais.',
      ] },
      { t: 'tip', text: 'Catálogo renomeado atualiza sozinho todas as fichas que usavam o nome antigo. Você não perde histórico ao ajustar o vocabulário.' },
    ],
  },
];

// Busca simples sobre título, resumo e texto dos blocos. Sem acento e sem
// caixa, igual à busca global do app. Consulta vazia devolve tudo.
const haystack = (a) =>
  normalize([
    a.title,
    a.summary,
    ...a.blocks.flatMap((b) => [b.text, b.caption, ...(b.items || [])]),
  ].filter(Boolean).join(' '));

export function searchWiki(query, articles = WIKI_ARTICLES) {
  const q = normalize(query).trim();
  if (!q) return [...articles];
  return articles.filter((a) => haystack(a).includes(q));
}

export function getWikiArticle(id, articles = WIKI_ARTICLES) {
  if (!id) return null;
  return articles.find((a) => a.id === id) || null;
}
