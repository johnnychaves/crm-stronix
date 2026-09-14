// Nota comum da ficha (src/lib/profileNote.js). O bug que motivou: a ficha
// guardava uma cópia da etapa e do funil feita ao abrir e comparava com o lead
// ao vivo. Se outro consultor movia o lead com a ficha aberta, a próxima nota
// comum devolvia o lead à etapa antiga. A nota agora é só nota: não recebe
// etapa nenhuma e não produz troca de fase.
import { describe, it, expect } from 'vitest';
import { planProfileNote } from '../profileNote.js';

describe('planProfileNote: nota comum da ficha', () => {
  it('vira anotação na timeline, no formato que a ficha já gravava', () => {
    expect(planProfileNote('Pediu retorno amanhã')).toEqual({ text: 'Obs: Pediu retorno amanhã.', type: 'note' });
  });

  it('corta os espaços das pontas', () => {
    expect(planProfileNote('  Ligação sem resposta  ')).toEqual({ text: 'Obs: Ligação sem resposta.', type: 'note' });
  });

  it('nota vazia não grava nada', () => {
    expect(planProfileNote('')).toBeNull();
    expect(planProfileNote('   ')).toBeNull();
    expect(planProfileNote(null)).toBeNull();
    expect(planProfileNote(undefined)).toBeNull();
  });

  it('nunca carrega troca de fase nem de funil', () => {
    expect(Object.keys(planProfileNote('Qualquer coisa')).sort()).toEqual(['text', 'type']);
  });
});
