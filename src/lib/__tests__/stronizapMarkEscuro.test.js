// A marca do Stronizap no bloco Agora da Meta, que é escuro nos dois temas
// (Parte B, PR 3). Sem onDark, o desenho é o de sempre, classe por classe: o
// marco de início e o agendamento pelo Stronizap na ficha não mudam.
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { StronizapBadge } from '../../components/brand/StronizapMark.jsx';

describe('marca do Stronizap no fundo escuro', () => {
  it('sem onDark, o desenho de sempre', () => {
    const out = renderToString(h(StronizapBadge));
    expect(out).toContain('class="grid size-[17px] shrink-0 place-items-center rounded-full bg-muted"');
    expect(out).toContain('class="fill-[#1A1D20] dark:fill-white"');
    expect(out).toContain('fill-[#25D366] stroke-[#25D366] dark:fill-[#128C7E] dark:stroke-[#128C7E]');
  });

  it('com onDark, balão branco e raio verde nos dois temas, num círculo translúcido', () => {
    const out = renderToString(h(StronizapBadge, { onDark: true }));
    expect(out).toContain('bg-white/[0.14]');
    expect(out).not.toContain('bg-muted');
    expect(out).toContain('class="fill-white"');
    expect(out).not.toContain('#1A1D20');
    expect(out).not.toContain('#128C7E');
  });
});
