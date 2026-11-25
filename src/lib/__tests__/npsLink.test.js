import { describe, it, expect } from 'vitest';
import { gerarNpsCode, npsLinkDe, NPS_CODE_TAMANHO } from '../npsLink.js';

describe('gerarNpsCode', () => {
  it('tem 10 símbolos, sem 0, o, 1 e l', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = gerarNpsCode();
      expect(code).toHaveLength(NPS_CODE_TAMANHO);
      expect(code).toMatch(/^[a-km-np-z2-9]+$/);
    }
  });

  it('cada byte vira um símbolo do alfabeto de 32', () => {
    const fixo = (bytes) => bytes.map((_, i) => [0, 31, 32, 255, 24, 23, 1, 2, 3, 4][i]);
    expect(gerarNpsCode(fixo)).toBe('a9a92zbcde');
  });
});

describe('npsLinkDe', () => {
  it('monta o endereço da página pública, e sem código não há link', () => {
    expect(npsLinkDe('https://stronilead.com.br', 'stronix-crm-app', 'k7q2mx9pla')).toBe('https://stronilead.com.br/avaliar/stronix-crm-app/k7q2mx9pla');
    expect(npsLinkDe('https://stronilead.com.br', 'stronix-crm-app', null)).toBeNull();
    expect(npsLinkDe('https://stronilead.com.br', null, 'abc')).toBeNull();
  });
});
