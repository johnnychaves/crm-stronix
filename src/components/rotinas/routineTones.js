// Os tons de cada estado da tarefa da rotina ('done', 'doneLate', 'late',
// 'now', 'later' e 'open', os da regra do dia em src/lib/rotinas.js). Divididos
// pelo cartão "Rotina de hoje" da Meta diária e pela tela Rotinas do gestor (a
// aba Hoje, a prévia do modelo aberto e a apresentação): um estado tem uma cor
// só no app inteiro.

// O círculo do estado. No escuro o bg-card é translúcido e a régua da linha do
// tempo aparece por dentro do círculo vazio, por isso os estados sem check
// levam fundo sólido.
export const CHECK_TONE = {
  done: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  doneLate: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
  late: 'border-rose-400 bg-rose-50 dark:bg-[#2a1326]',
  now: 'border-brand-600 bg-card ring-4 ring-brand-600/15 dark:bg-[#0c1126]',
  later: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
  open: 'border-slate-300 bg-card dark:border-white/20 dark:bg-[#0c1126]',
};

// O texto do estado, embaixo do nome da tarefa.
export const META_TONE = {
  done: 'text-emerald-700 dark:text-emerald-300',
  doneLate: 'text-amber-700 dark:text-amber-300',
  late: 'text-rose-600 dark:text-rose-300',
  now: 'font-medium text-brand-600 dark:text-brand-300',
  later: 'text-muted-foreground',
  open: 'text-muted-foreground',
};

// As barrinhas da contagem, no cabeçalho do cartão da Meta.
export const SEG_TONE = {
  done: 'bg-emerald-600 dark:bg-emerald-500',
  doneLate: 'bg-emerald-600 dark:bg-emerald-500',
  late: 'bg-rose-500',
  now: 'bg-brand-600',
  later: 'bg-slate-200 dark:bg-white/15',
  open: 'bg-slate-200 dark:bg-white/15',
};
