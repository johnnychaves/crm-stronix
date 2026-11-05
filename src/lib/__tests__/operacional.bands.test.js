import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import { TasksBand } from '../../views/dashboard/OperacionalBands.jsx';

const render = (props) => renderToString(createElement(TooltipProvider, null, createElement(TasksBand, props)));
const TASKS = { novos: 3, contatos: 5, agenda: 2, atrasados: 1, renovacoes: 0, vencidos: 0, total: 11 };

describe('TasksBand, rótulo do comparado', () => {
  it('mês em andamento compara os mesmos dias', () => {
    const html = render({ tasks: TASKS, compareTasks: TASKS, cmpName: 'fevereiro', running: true });
    expect(html).toContain('contra os mesmos dias de fevereiro');
  });

  it('mês fechado compara o mês inteiro, sem dizer "mesmos dias"', () => {
    const html = render({ tasks: TASKS, compareTasks: TASKS, cmpName: 'fevereiro', running: false, shownName: 'março' });
    expect(html).toContain('contra fevereiro');
    expect(html).not.toContain('mesmos dias');
    expect(html).toContain('março');
    expect(html).not.toContain('este mês');
  });
});
