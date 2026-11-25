import { describe, it, expect } from 'vitest';
import { matrizDoQr } from '../qrPng.js';

describe('matrizDoQr', () => {
  it('é quadrada, com a borda branca de 4 módulos e o canto de leitura no lugar', () => {
    const m = matrizDoQr('https://stronilead.com.br/avaliar/stronix-crm-app/k7q2mx9pla');
    expect(m.length).toBeGreaterThan(21 + 8);
    m.forEach((linha) => expect(linha).toHaveLength(m.length));
    expect(m[0].every((c) => !c)).toBe(true);
    expect(m[3].every((c) => !c)).toBe(true);
    // O quadrado de leitura do canto começa logo depois da borda.
    expect(m[4].slice(4, 11).every(Boolean)).toBe(true);
  });
});
