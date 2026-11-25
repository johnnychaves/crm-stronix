import { describe, it, expect } from 'vitest';
import { avaliarRouteOf } from '../avaliarRoute.js';

describe('avaliarRouteOf', () => {
  it('lê a academia e o código', () => {
    expect(avaliarRouteOf('/avaliar/stronix-crm-app/k7q2mx9pza')).toEqual({ slug: 'stronix-crm-app', code: 'k7q2mx9pza' });
    expect(avaliarRouteOf('/avaliar/Stronix-CRM-App/k7q2mx9pza/')).toEqual({ slug: 'stronix-crm-app', code: 'k7q2mx9pza' });
  });

  it('endereço incompleto ainda é da página, que mostra o link inválido', () => {
    expect(avaliarRouteOf('/avaliar')).toEqual({ slug: '', code: '' });
    expect(avaliarRouteOf('/avaliar/stronix-crm-app')).toEqual({ slug: 'stronix-crm-app', code: '' });
  });

  it('outro endereço não é da página', () => {
    expect(avaliarRouteOf('/stronix-crm-app/pipeline')).toBeNull();
    expect(avaliarRouteOf('/avaliacoes/x/y')).toBeNull();
    expect(avaliarRouteOf('/')).toBeNull();
  });
});
