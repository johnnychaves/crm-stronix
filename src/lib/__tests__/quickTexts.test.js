import { describe, it, expect } from 'vitest';
import { QUICK_TEXTS, appendQuickText } from '../quickTexts.js';

describe('QUICK_TEXTS', () => {
  it('tem atalhos para anotação e ligação, e nenhum para o WhatsApp', () => {
    expect(QUICK_TEXTS.note).toEqual(['Pediu para ligar depois', 'Vai pensar', 'Pediu desconto', 'Treina em outra academia']);
    expect(QUICK_TEXTS.call).toEqual(['Não atendeu', 'Caixa postal', 'Atendeu e pediu retorno', 'Número errado']);
    // O texto do WhatsApp é a mensagem que vai para a pessoa: atalho de registro seria enviado a ela.
    expect(QUICK_TEXTS.whatsapp).toBeUndefined();
  });
});

describe('appendQuickText', () => {
  it('caixa vazia recebe o atalho como está', () => {
    expect(appendQuickText('', 'Vai pensar')).toBe('Vai pensar');
    expect(appendQuickText(undefined, 'Vai pensar')).toBe('Vai pensar');
    expect(appendQuickText('   \n', 'Vai pensar')).toBe('Vai pensar');
  });

  it('com texto, o atalho entra na linha de baixo, sem espaço sobrando no fim', () => {
    expect(appendQuickText('Pediu desconto', 'Vai pensar')).toBe('Pediu desconto\nVai pensar');
    expect(appendQuickText('Pediu desconto  \n', 'Vai pensar')).toBe('Pediu desconto\nVai pensar');
  });
});
