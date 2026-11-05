// A tela de bloqueio por atraso leva o gestor direto à fatura do Asaas.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TenantBlockedScreen } from '../../views/auth/TenantBlockedScreen.jsx';

const URL_FATURA = 'https://www.asaas.com/i/fatura-teste';
const html = (props) => renderToStaticMarkup(createElement(TenantBlockedScreen, { onLogout: () => {}, ...props }));

describe('TenantBlockedScreen, pagamento pendente', () => {
  it('o gestor ganha o Pagar fatura com o link da fatura, em outra aba', () => {
    const out = html({ reason: 'payment_overdue', isAdmin: true, invoiceUrl: URL_FATURA });
    expect(out).toContain(`href="${URL_FATURA}"`);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('Pagar fatura');
    expect(out).toContain('Sair');
  });

  it('a equipe não vê o link e é mandada ao gestor', () => {
    const out = html({ reason: 'payment_overdue', isAdmin: false, invoiceUrl: URL_FATURA });
    expect(out).not.toContain(URL_FATURA);
    expect(out).toContain('Avise o gestor');
  });

  it('sem link da fatura, o gestor é mandado ao suporte', () => {
    const out = html({ reason: 'payment_overdue', isAdmin: true, invoiceUrl: null });
    expect(out).not.toContain('Pagar fatura');
    expect(out).toContain('fale com o suporte');
  });

  it('academia suspensa nunca mostra fatura', () => {
    const out = html({ reason: 'suspended', isAdmin: true, invoiceUrl: URL_FATURA });
    expect(out).not.toContain('Pagar fatura');
  });
});
