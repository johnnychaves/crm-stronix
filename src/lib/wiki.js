// ============================================================================
// CENTRAL DE AJUDA — o conteúdo da wiki do Stronilead.
// Mora no código (versionado, sem backend). Artigo novo = 1 entrada aqui.
//
// Cada artigo é um passo a passo de PONTA A PONTA de uma mecânica: começa em
// onde clicar e termina no que o sistema fez com aquilo. O corpo é uma lista de
// BLOCOS, não markdown: o renderer conhece cada tipo e cuida do estilo, então o
// texto nunca sai do padrão visual do app.
//   { t: 'h',     text }                        subtítulo (divide o artigo)
//   { t: 'p',     text }                        parágrafo
//   { t: 'steps', items: [] }                   passo a passo numerado
//   { t: 'tip',   text }                        caixa de dica (laranja)
//   { t: 'warn',  text }                        caixa de atenção
//   { t: 'demo',  name, caption }               demonstração animada da tela
//                                               (components/help/WikiDemo.jsx)
//   { t: 'media', src, alt, caption }           GIF ou vídeo gravado da tela.
//                                               Ponha o arquivo em public/ajuda/
//                                               e use src: '/ajuda/nome.gif'.
//
// Sobre GIF: os blocos `demo` mostram a interação em animação de código, que
// pesa zero, fica nítida em qualquer tela, acompanha o tema claro/escuro e não
// expõe dado de aluno real. Para trocar por uma gravação de verdade, basta
// substituir o bloco:
//   { t: 'demo', name: 'pipeline', caption: '…' }
//   { t: 'media', src: '/ajuda/pipeline.gif', alt: '…', caption: '…' }
// ============================================================================

import { normalize } from './globalSearch.js';

export const BLOCK_KINDS = ['h', 'p', 'steps', 'tip', 'warn', 'demo', 'media'];

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
    id: 'jornada',
    category: 'inicio',
    title: 'A jornada completa: do lead à matrícula',
    summary: 'O caminho inteiro de uma pessoa no sistema, do primeiro contato ao contrato assinado.',
    blocks: [
      { t: 'p', text: 'Este artigo mostra a mecânica inteira em ordem. Cada etapa tem um artigo próprio com mais detalhe, mas aqui você vê como tudo se encaixa.' },

      { t: 'h', text: '1. A pessoa entra' },
      { t: 'p', text: 'Alguém manda mensagem, aparece na recepção ou é indicado por um aluno. Você cadastra em Cadastrar lead, no topo da tela. Nome, WhatsApp e a dor são obrigatórios.' },
      { t: 'demo', name: 'novo-lead', caption: 'O cadastro avisa na hora se o número já existe.' },
      { t: 'p', text: 'A pessoa vira um card na primeira etapa do funil e entra na sua Meta Diária como lead novo para contatar em 24 horas.' },

      { t: 'h', text: '2. Você trabalha o contato' },
      { t: 'p', text: 'Todo dia a Meta Diária monta a lista de quem precisa de você: leads novos, retornos agendados, atrasados e clientes na janela de renovação.' },
      { t: 'demo', name: 'meta', caption: 'A tarefa concluída sai da lista.' },
      { t: 'p', text: 'Cada conversa vira um registro na linha do tempo da pessoa. Se ela pedir para falar depois, você reagenda e ela volta na data escolhida.' },

      { t: 'h', text: '3. A pessoa vem conhecer' },
      { t: 'p', text: 'O passo que mais converte é trazer a pessoa para dentro. Agende uma visita ou uma aula experimental pela ficha ou pelo card da Meta.' },
      { t: 'demo', name: 'agendar', caption: 'Aula experimental exige professor e modalidade.' },
      { t: 'p', text: 'No dia, registre o que aconteceu. Quem compareceu avança sozinho para Negociação, porque a conversa mudou de estágio.' },
      { t: 'demo', name: 'desfecho', caption: 'O desfecho move a pessoa no funil.' },

      { t: 'h', text: '4. Fecha ou não fecha' },
      { t: 'p', text: 'Fechou: arraste o card para Venda e registre plano, valor e vigência. A pessoa vira cliente e o contrato aparece na ficha dela.' },
      { t: 'demo', name: 'matricula', caption: 'O fim da vigência sai da duração do plano.' },
      { t: 'p', text: 'Não fechou: arraste para Perda e diga por quê. O motivo alimenta o relatório que mostra onde a academia mais perde gente.' },
      { t: 'demo', name: 'perda', caption: 'Perda sempre pede um motivo.' },

      { t: 'h', text: '5. O ciclo recomeça' },
      { t: 'p', text: 'O cliente volta para a sua lista nos marcos de renovação, por padrão 90, 60 e 30 dias antes do contrato vencer. E se ele indicar um amigo, a indicação entra no funil de Indicações já ligada ao nome dele.' },
      { t: 'tip', text: 'Perdeu alguém? Não apague. Lead perdido com motivo registrado é matéria-prima de campanha de retomada depois.' },
    ],
  },
  {
    id: 'pipeline',
    category: 'inicio',
    title: 'Como o pipeline funciona',
    summary: 'As colunas do Kanban, o que cada uma significa e como mover uma pessoa de etapa.',
    blocks: [
      { t: 'p', text: 'O Pipeline é o quadro onde cada pessoa aparece como um card. As colunas são as etapas do seu funil, e a posição do card diz em que ponto da conversa aquela pessoa está.' },

      { t: 'h', text: 'As três colunas que todo funil tem' },
      { t: 'steps', items: [
        'Negociação: a reta final. Quem compareceu a uma visita ou aula cai aqui sozinho.',
        'Venda: as matrículas do mês. A coluna zera na virada do mês, porque ela mede o mês corrente.',
        'Perda: quem desistiu, sempre com um motivo registrado.',
      ] },
      { t: 'p', text: 'As etapas do meio são suas. Configure em Configurações, Funis e etapas, com os nomes que a sua operação usa no dia a dia.' },

      { t: 'h', text: 'Movendo uma pessoa' },
      { t: 'demo', name: 'pipeline', caption: 'Arraste o card para mudar a etapa.' },
      { t: 'steps', items: [
        'Arraste o card para a coluna nova. No celular, abra a ficha e use Mudar fase.',
        'Ao soltar em Venda, o sistema pede plano, valor e início da vigência antes de registrar.',
        'Ao soltar em Perda, ele pergunta o motivo.',
      ] },
      { t: 'p', text: 'Toda mudança de etapa entra na linha do tempo da pessoa, com data e quem moveu. Você consegue reconstruir a história inteira depois.' },

      { t: 'h', text: 'Lendo o card' },
      { t: 'p', text: 'O card mostra o nome, o próximo passo agendado e há quantos dias a pessoa está sem contato. Quando esse número cresce, ela está esfriando.' },
      { t: 'tip', text: 'O board carrega de dez em dez. Se a coluna tiver mais gente, o botão no rodapé traz o próximo lote, em vez de pesar a tela inteira de uma vez.' },
      { t: 'warn', text: 'Cliente não aparece no Kanban. Depois da matrícula a pessoa sai do quadro de vendas e passa a viver na aba Clientes, com o contrato dela.' },
    ],
  },
  {
    id: 'cadastrar-lead',
    category: 'inicio',
    title: 'Cadastrando um lead do jeito certo',
    summary: 'Os campos que importam, a verificação de duplicidade e o que cada informação faz depois.',
    blocks: [
      { t: 'p', text: 'O botão Cadastrar lead fica no topo de qualquer tela. Leva menos de um minuto e é o que alimenta todo o resto do sistema.' },

      { t: 'h', text: 'Passo a passo' },
      { t: 'demo', name: 'novo-lead', caption: 'A verificação de número roda enquanto você digita.' },
      { t: 'steps', items: [
        'Nome e WhatsApp com DDD. Os dois são obrigatórios.',
        'Como chegou: escolha a origem. Se foi um aluno que indicou, ligue o interruptor É uma indicação? e busque o aluno.',
        'Onde entra: funil e etapa inicial. O padrão já vem escolhido, e na maioria dos casos é o certo.',
        'O que busca: a dor, ou seja, o que a pessoa quer resolver. É obrigatória porque é o gancho do primeiro contato.',
        'Detalhes opcionais: etiquetas, nascimento, CPF, e-mail e uma observação livre.',
      ] },

      { t: 'h', text: 'Por que cada campo existe' },
      { t: 'steps', items: [
        'A origem alimenta o relatório de canais, que mostra de onde vêm seus melhores alunos.',
        'A dor aparece na ficha e no card, para o consultor abrir a conversa sabendo do que falar.',
        'A modalidade de interesse ajuda a escolher o professor certo na aula experimental.',
        'A observação vira a primeira anotação da linha do tempo.',
      ] },

      { t: 'h', text: 'Número repetido' },
      { t: 'warn', text: 'Se o WhatsApp já existir na base, o cadastro é bloqueado e o sistema mostra quem é a pessoa, quem está responsável e em que etapa ela está. A verificação cobre a base inteira, inclusive clientes e perdidos, para dois consultores não trabalharem o mesmo contato sem saber.' },
      { t: 'p', text: 'Quando isso acontecer, procure a pessoa na busca do topo e continue o trabalho na ficha que já existe, em vez de criar uma segunda.' },
      { t: 'demo', name: 'busca', caption: 'A busca do topo acha por nome, CPF ou telefone.' },
    ],
  },
  {
    id: 'ficha',
    category: 'inicio',
    title: 'A ficha da pessoa, aba por aba',
    summary: 'Linha do tempo, dados de CRM, contratos e indicações: o que fica em cada lugar.',
    blocks: [
      { t: 'p', text: 'Clicar em qualquer card, resultado de busca ou linha de lista abre a ficha. Ela é o histórico completo daquela pessoa com a academia.' },

      { t: 'h', text: 'O cabeçalho' },
      { t: 'p', text: 'O topo responde quatro perguntas de uma vez: em que estado a pessoa está, qual o contato, quem é o consultor responsável e qual o próximo passo agendado. Ao lado do nome ficam as ações de WhatsApp, ligar e, para cliente, o link de indicação.' },

      { t: 'h', text: 'As abas' },
      { t: 'demo', name: 'ficha', caption: 'A aba Indicações aparece só para alunos.' },
      { t: 'steps', items: [
        'Linha do tempo: tudo que aconteceu, em ordem. Tem filtros por conversas, agendamentos, anotações e marcos, e um interruptor para mostrar também os eventos de sistema.',
        'CRM: dados cadastrais, etiquetas e responsável. É onde você corrige informação errada.',
        'Contratos: plano vigente, histórico completo e as ações de renovar, trancar, cancelar ou corrigir.',
        'Indicações: só para alunos. Mostra o link dele, quem ele trouxe e quantos viraram alunos.',
      ] },

      { t: 'h', text: 'Registrando o que aconteceu' },
      { t: 'steps', items: [
        'Anotação: escreva o que foi conversado. Anotação importante pode ser fixada e sobe para o topo.',
        'Mudar fase: move a pessoa no funil sem sair da ficha.',
        'Agendar: marca visita ou aula experimental.',
      ] },
      { t: 'tip', text: 'Qualquer consultor pode registrar na linha do tempo de qualquer pessoa, mesmo não sendo o responsável. Já editar dados, marcar venda ou perda e trocar o responsável ficam com o dono do lead e com o administrador.' },
    ],
  },

  // ------------------------------------------------------------------- dia --
  {
    id: 'meta-diaria',
    category: 'dia',
    title: 'Meta diária de ponta a ponta',
    summary: 'Como a lista do dia é montada, como concluir cada tarefa e o que conta como prospecção.',
    blocks: [
      { t: 'p', text: 'A Meta Diária é a tela em que o consultor começa o dia. Ela monta sozinha a lista do que precisa de atenção hoje, para ninguém depender de memória ou de caderninho.' },

      { t: 'h', text: 'O que entra na lista' },
      { t: 'steps', items: [
        'Lead novo: cadastrado nas últimas 24 horas e ainda sem contato.',
        'Contato de hoje: quem você agendou para retornar hoje.',
        'Atrasado: o retorno venceu e ninguém falou com a pessoa.',
        'Agenda do dia: visitas e aulas experimentais marcadas para hoje.',
        'Renovação: clientes que entraram na janela dos marcos configurados.',
        'Vencidos: cliente cujo contrato venceu e que segue na lista todo dia, enquanto o prazo configurado durar.',
      ] },

      { t: 'h', text: 'Concluindo uma tarefa' },
      { t: 'demo', name: 'meta', caption: 'Concluída, a tarefa sai da lista.' },
      { t: 'steps', items: [
        'Abra a tarefa e fale com a pessoa.',
        'Registre o que aconteceu: ligação, mensagem enviada ou anotação.',
        'Decida o próximo passo. Vai falar de novo? Reagende. Vem conhecer? Agende visita ou aula. Desistiu? Marque perda com o motivo.',
      ] },
      { t: 'p', text: 'Só some da lista o que teve desfecho. Uma tarefa que você abriu e não resolveu continua ali, porque continua pendente de verdade.' },

      { t: 'h', text: 'Prospecção e o Dia perfeito' },
      { t: 'p', text: 'Além das tarefas, existe um piso de prospecção: um mínimo de ações novas por dia. Conta agendar visita ou aula, registrar ligação ou mensagem e cadastrar lead novo.' },
      { t: 'tip', text: 'Quem zera as tarefas e ainda bate a prospecção ganha o selo Dia perfeito. O gestor acompanha as duas metas lado a lado no Painel da Equipe.' },
      { t: 'warn', text: 'A meta é individual e usa o fuso do dia local. Tarefa concluída perto da meia-noite conta no dia em que você a concluiu, não no seguinte.' },
    ],
  },
  {
    id: 'agendamentos',
    category: 'dia',
    title: 'Visitas e aulas experimentais, do agendamento ao desfecho',
    summary: 'Como marcar, o que muda entre visita e aula, e por que registrar o comparecimento importa tanto.',
    blocks: [
      { t: 'p', text: 'Visita é a pessoa conhecendo a academia. Aula experimental é ela treinando com um professor. As duas são o passo que mais converte, e as duas seguem a mesma mecânica.' },

      { t: 'h', text: 'Agendando' },
      { t: 'demo', name: 'agendar', caption: 'Aula exige professor e modalidade; visita, não.' },
      { t: 'steps', items: [
        'Na ficha ou no card da Meta, escolha Agendar.',
        'Escolha o tipo: visita ou aula experimental.',
        'Defina data e hora. Na aula, escolha também o professor e a modalidade.',
        'Confirme. O compromisso aparece na Agenda do dia de quem for atender e no card da pessoa.',
      ] },

      { t: 'h', text: 'Registrando o desfecho' },
      { t: 'demo', name: 'desfecho', caption: 'Compareceu avança a pessoa para Negociação.' },
      { t: 'steps', items: [
        'Compareceu: a pessoa avança sozinha para Negociação e a aula fica registrada no histórico do professor.',
        'Não veio: fica registrado e a pessoa volta para o fluxo de contato.',
        'Remarcou: escolha a data nova e o compromisso se move.',
        'Cancelou: encerra o agendamento sem mover a pessoa no funil.',
      ] },

      { t: 'h', text: 'Por que isso importa' },
      { t: 'warn', text: 'Agendamento sem desfecho fica no limbo: não conta como comparecimento nem como falta, e some dos relatórios. A taxa de comparecimento e a conversão por professor saem exatamente desses registros.' },
      { t: 'tip', text: 'A academia define quantas aulas experimentais cada pessoa pode fazer. Quando o limite acaba, o sistema avisa na hora de agendar a próxima.' },
    ],
  },

  // ------------------------------------------------------------ fechamento --
  {
    id: 'matricula',
    category: 'fechamento',
    title: 'Matrícula e contrato, do arraste ao registro',
    summary: 'O que o sistema grava quando a pessoa fecha, e como corrigir se algo saiu errado.',
    blocks: [
      { t: 'p', text: 'Fechar uma matrícula é o único momento em que o sistema cria um contrato. Por isso ele pede os dados na hora, em vez de deixar para depois.' },

      { t: 'h', text: 'Fechando' },
      { t: 'demo', name: 'matricula', caption: 'Plano, valor e início da vigência.' },
      { t: 'steps', items: [
        'Arraste o card para Venda, ou use Mudar fase na ficha e escolha Venda.',
        'Escolha o plano. O valor vem preenchido pelo catálogo e aceita desconto com motivo.',
        'Confirme quando a vigência começa. Não precisa ser hoje: matrícula retroativa ou com início futuro é normal.',
        'Salve. O sistema calcula o fim da vigência pela duração do plano.',
      ] },

      { t: 'h', text: 'O que acontece por baixo' },
      { t: 'steps', items: [
        'A pessoa deixa de ser lead e vira cliente: sai do Kanban e passa a aparecer na aba Clientes.',
        'O contrato entra na aba Contratos, com vigência e valor.',
        'A matrícula conta no mês em que aconteceu, para o resultado do consultor e da academia.',
        'Se a pessoa veio por indicação, quem indicou recebe o aviso na linha do tempo dele.',
      ] },

      { t: 'h', text: 'Corrigindo' },
      { t: 'tip', text: 'Errou plano, valor ou data? A aba Contratos tem a correção do contrato vigente. Não precisa desfazer a matrícula e refazer tudo.' },
      { t: 'warn', text: 'Tirar a pessoa de Venda desfaz a conversão: ela volta a ser lead e sai da contagem de matrículas do mês. Use isso só quando a venda realmente não aconteceu.' },
    ],
  },
  {
    id: 'renovacao',
    category: 'fechamento',
    title: 'Renovação por marcos',
    summary: 'Quando o cliente entra na sua lista, como conduzir a conversa e o que fazer com cada resposta.',
    blocks: [
      { t: 'p', text: 'Renovação não é uma conversa só no último dia. O sistema traz o cliente para a sua Meta Diária em marcos, para você ter tempo de trabalhar a decisão dele.' },

      { t: 'h', text: 'Os marcos' },
      { t: 'p', text: 'O padrão é 90, 60 e 30 dias antes do contrato vencer, e a academia pode mudar isso em Configurações. Cada marco é uma conversa, não um lembrete repetido: quando você trata um marco, ele não volta.' },
      { t: 'tip', text: 'Os marcos param no dia do vencimento. Dali em diante o cliente continua sendo cobrado no funil Vencidos, com desfechos próprios.' },

      { t: 'h', text: 'Conduzindo' },
      { t: 'steps', items: [
        'Abra a tarefa de renovação na Meta Diária.',
        'Fale com o aluno e registre a resposta dele.',
        'Vai renovar: registre o plano novo. A vigência emenda na data certa, sem buraco nem sobreposição, e o contrato anterior vira histórico.',
        'Não vai renovar agora: registre o desfecho. Ele sai da meta sem sumir do radar, e volta no próximo marco.',
        'Quer pensar: reagende para a data que ele pediu.',
      ] },

      { t: 'h', text: 'Trancar e cancelar' },
      { t: 'p', text: 'A aba Contratos também trata o que foge do fluxo normal: trancar o contrato por um período, cancelar com motivo ou reativar depois. Tudo fica no histórico.' },
      { t: 'warn', text: 'Renovação não recarimba a data de conversão. A matrícula original continua contando no mês em que aconteceu de verdade, para o histórico do consultor não se mexer.' },
    ],
  },
  {
    id: 'vencidos',
    category: 'fechamento',
    title: 'Contrato vencido: quem continua na sua lista',
    summary: 'Por quantos dias o cliente vencido volta na Meta Diária, o que fazer com ele e onde isso se ajusta.',
    blocks: [
      { t: 'p', text: 'A renovação trabalha o cliente antes de o contrato vencer. Do dia do vencimento em diante quem assume é o funil Vencidos, e a pessoa volta na sua lista todo dia enquanto durar o prazo que a academia definiu. É a janela em que ela ainda tem a rotina de treino fresca e é mais fácil de trazer de volta.' },

      { t: 'h', text: 'Quem entra na lista' },
      { t: 'steps', items: [
        'Cliente com contrato vencido, a partir do próprio dia do vencimento.',
        'Que não avisou antes que ia sair. Quem já respondeu "não vou renovar" na fase de renovação fica de fora.',
        'Que não tem contato marcado para hoje ou para depois. Se tiver, ele aparece em Contatos, para você não receber a mesma pessoa duas vezes.',
        'Contrato trancado ou cancelado não entra. A lista é de quem chegou ao fim da vigência sem renovar.',
      ] },
      { t: 'p', text: 'A ordem é do vencimento mais recente para o mais antigo, porque a chance de trazer alguém de volta cai a cada dia fora. O card mostra "Venceu hoje" ou "Venceu há 4 dias".' },

      { t: 'h', text: 'Os três desfechos' },
      { t: 'steps', items: [
        'Reativou: abre o fluxo de matrícula com os dados do cliente e o contrato recomeça.',
        'Não vai voltar: peça o motivo e registre. Ele sai desta cobrança e continua na base como inativo.',
        'Reagendar contato: escolha uma data futura. Ele volta pelo funil Contatos no dia combinado.',
      ] },
      { t: 'p', text: 'Enquanto não tiver desfecho, a tarefa volta amanhã. É a mesma lógica dos atrasados.' },

      { t: 'h', text: 'Quando o prazo acaba' },
      { t: 'p', text: 'Passado o prazo, o cliente sai da Meta Diária. Daí para frente a conversa é outra: não é mais renovar um contrato recente, é reativar um ex-aluno, trabalho de campanha e lista.' },
      { t: 'tip', text: 'O prazo fica em Configurações, Metas & ritmo, no painel Funil de vencidos. O padrão é 15 dias e vai de 0 a 90. Com 0, o cliente é cobrado só no dia em que o contrato vence.' },
      { t: 'warn', text: 'Os marcos de renovação valem só até o vencimento. Se você quer falar com o cliente antes de ele vencer, mexa lá, não aqui.' },
    ],
  },

  // ------------------------------------------------------------- indicações --
  {
    id: 'indicacoes',
    category: 'indicacoes',
    title: 'Indicações de ponta a ponta',
    summary: 'Registrar quem indicou, acompanhar o convite e saber quantos viraram alunos.',
    blocks: [
      { t: 'p', text: 'Indicação é o canal mais barato que uma academia tem. O Stronilead liga cada indicado ao aluno que o trouxe, para você saber quem são seus melhores divulgadores e o que aconteceu com cada convite.' },

      { t: 'h', text: '1. Registrando a indicação' },
      { t: 'demo', name: 'indicacao-switch', caption: 'O interruptor troca o cadastro para o modo indicação.' },
      { t: 'steps', items: [
        'Abra Cadastrar lead e preencha nome e WhatsApp.',
        'Na seção Como chegou, ligue o interruptor É uma indicação?.',
        'Busque o aluno que indicou. Só quem já é aluno matriculado aparece na busca.',
        'Salve. Não precisa escolher funil nem etapa: o sistema já sabe para onde vai.',
      ] },

      { t: 'h', text: '2. Para onde o indicado vai' },
      { t: 'p', text: 'O lead entra no funil Indicações, na etapa Aguardando ação, com a origem Indicação e o mesmo consultor responsável pelo aluno que indicou. As indicações ficam todas juntas, num funil que a equipe trabalha sabendo que aquela pessoa chegou por confiança.' },
      { t: 'p', text: 'A partir daí é o fluxo normal: contato, visita ou aula, e fechamento. O funil de Indicações também tem Negociação, Venda e Perda.' },

      { t: 'h', text: '3. Acompanhando o resultado' },
      { t: 'demo', name: 'ficha', caption: 'A aba Indicações na ficha do aluno.' },
      { t: 'p', text: 'Na ficha do aluno que indicou, a aba Indicações mostra o resumo: quantos ele trouxe, quantos viraram alunos, quantos ainda estão em andamento e quantos se perderam. A lista embaixo é clicável e leva à ficha de cada indicado.' },
      { t: 'p', text: 'Quando um indicado fecha matrícula, entra um aviso na linha do tempo de quem indicou. Fica registrado para sempre que aquele aluno trouxe um cliente novo.' },

      { t: 'h', text: '4. Corrigindo e vinculando depois' },
      { t: 'steps', items: [
        'Vínculo errado: na ficha do indicado, clique no lápis ao lado de Indicado por e troque ou remova.',
        'Lead antigo sem vínculo: use a ferramenta Indicações sem dono, em Configurações, Pessoas.',
        'Lead que já está no sistema: mova para o funil Indicações pelo Mudar fase, e ele vai pedir o indicador.',
      ] },
      { t: 'demo', name: 'backfill', caption: 'A fila de indicações antigas sem dono.' },
      { t: 'tip', text: 'Só aluno matriculado pode ser indicador. Se um lead ainda não fechado indicou alguém, registre a origem como Indicação e faça o vínculo quando ele virar aluno.' },
    ],
  },
  {
    id: 'link-indicacao',
    category: 'indicacoes',
    title: 'O link de indicação de cada aluno',
    summary: 'O aluno convida sozinho pelo WhatsApp e o lead entra vinculado, sem ninguém digitar nada.',
    blocks: [
      { t: 'p', text: 'Cada aluno tem um link próprio. Quem abrir vê a marca da academia e o nome de quem convidou, deixa o contato e vira lead na hora. É a mesma indicação do cadastro manual, só que sem trabalho para a equipe.' },

      { t: 'h', text: '1. Pegando o link' },
      { t: 'demo', name: 'indicacao-link', caption: 'Copiar ou mandar direto no WhatsApp do aluno.' },
      { t: 'steps', items: [
        'Abra a ficha do aluno.',
        'Clique em Link de indicação, no cabeçalho, ao lado do WhatsApp.',
        'Escolha Copiar link, para mandar do seu jeito, ou Enviar pro cliente, que abre o WhatsApp dele já com a mensagem pronta.',
      ] },

      { t: 'h', text: '2. O que o amigo vê' },
      { t: 'p', text: 'Uma página só dele, com o nome da academia, o logo e a frase dizendo que fulano convidou. O formulário pede nome e WhatsApp, e deixa CPF e modalidade como opcionais. Nada de senha, nada de cadastro complicado.' },
      { t: 'p', text: 'Ao enviar, ele vê a confirmação dizendo que a equipe vai chamar no WhatsApp. Só isso.' },

      { t: 'h', text: '3. O que acontece no sistema' },
      { t: 'steps', items: [
        'O lead nasce no funil Indicações, etapa Aguardando ação, com a origem Indicação.',
        'Já vem vinculado ao aluno que compartilhou o link.',
        'O consultor responsável é o mesmo do aluno, então a indicação cai na carteira certa e entra na Meta Diária dele.',
        'Você recebe o aviso no sino do topo, com o nome do indicado e de quem indicou.',
      ] },

      { t: 'h', text: 'Perguntas comuns' },
      { t: 'warn', text: 'E se a pessoa já tiver cadastro? O sistema não duplica. Ela vê a mesma mensagem de sucesso, e fica um registro na ficha que já existe para a equipe decidir o que fazer. Isso protege a base e evita que alguém use o link para pescar quem é aluno.' },
      { t: 'tip', text: 'O link não expira e é sempre o mesmo para aquele aluno. Ele pode mandar no grupo da família, no story, onde quiser.' },
    ],
  },

  // ---------------------------------------------------------------- config --
  {
    id: 'configuracoes',
    category: 'config',
    title: 'O que configurar primeiro',
    summary: 'A ordem que faz o sistema funcionar redondo desde o primeiro dia.',
    blocks: [
      { t: 'p', text: 'Configurações tem sete destinos. A Visão geral mostra o que ainda falta preencher, em ordem de importância, então comece por ela.' },

      { t: 'h', text: 'A ordem que recomendamos' },
      { t: 'steps', items: [
        'Pessoas: cadastre a equipe e defina quem é administrador. Sem isso ninguém tem carteira.',
        'Funis e etapas: desenhe as colunas do Pipeline com os nomes que a sua operação fala.',
        'Catálogos: origens, motivos de perda, dores, etiquetas e planos. É o vocabulário do sistema.',
        'Ritmo: meta diária, piso de prospecção e turnos de cada consultor.',
        'Agendamento: modalidades, professores e quantas aulas experimentais cada pessoa pode fazer.',
      ] },

      { t: 'h', text: 'Ferramentas que resolvem bagunça' },
      { t: 'steps', items: [
        'Migrar leads: passa a carteira inteira de um consultor para outro, útil quando alguém sai ou entra no time.',
        'Indicações sem dono: mostra os leads que vieram por indicação e ficaram sem vínculo, para você dizer quem indicou cada um.',
      ] },
      { t: 'demo', name: 'backfill', caption: 'Cada linha tem a busca do aluno que indicou.' },

      { t: 'h', text: 'Mexer no catálogo depois' },
      { t: 'tip', text: 'Catálogo renomeado atualiza sozinho todas as fichas que usavam o nome antigo. Você não perde histórico ao ajustar o vocabulário com o tempo.' },
      { t: 'warn', text: 'Etapa com gente dentro não pode ser excluída. Mova as pessoas para outra etapa antes, para ninguém sumir do quadro sem querer.' },
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
