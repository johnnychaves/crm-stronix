// Testes das funções PURAS de src/lib/leadPhoto.js (as que não dependem de
// canvas/DOM). O processamento de imagem e o upload rodam só no navegador e são
// verificados no smoke ao vivo — aqui cobrimos caminho e validação de entrada.

import { describe, it, expect } from 'vitest';
import { leadPhotoPath, isSupportedImage } from '../leadPhoto.js';

describe('leadPhotoPath', () => {
  it('monta o caminho isolado por tenant e lead', () => {
    expect(leadPhotoPath('stronix-crm-app', 'LEAD123')).toBe(
      'tenants/stronix-crm-app/leads/LEAD123/avatar.jpg'
    );
  });
});

describe('isSupportedImage', () => {
  it('aceita jpeg, png e webp dentro do teto de entrada', () => {
    expect(isSupportedImage({ type: 'image/jpeg', size: 500_000 })).toBe(true);
    expect(isSupportedImage({ type: 'image/png', size: 500_000 })).toBe(true);
    expect(isSupportedImage({ type: 'image/webp', size: 500_000 })).toBe(true);
  });

  it('rejeita tipos não suportados', () => {
    expect(isSupportedImage({ type: 'application/pdf', size: 500 })).toBe(false);
    expect(isSupportedImage({ type: 'image/gif', size: 500 })).toBe(false);
    expect(isSupportedImage({ type: '', size: 500 })).toBe(false);
  });

  it('rejeita arquivo acima do teto de entrada (10MB)', () => {
    expect(isSupportedImage({ type: 'image/jpeg', size: 11 * 1024 * 1024 })).toBe(false);
  });

  it('rejeita entrada nula/indefinida', () => {
    expect(isSupportedImage(null)).toBe(false);
    expect(isSupportedImage(undefined)).toBe(false);
  });
});
