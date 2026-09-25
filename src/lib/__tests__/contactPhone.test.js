import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ContactPhone } from '../../components/profile/ContactPhone.jsx';

const HOJE = new Date(2026, 8, 24, 10, 0);
const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const html = (props) => renderToString(createElement(ContactPhone, { now: HOJE, ...props }));

describe('ContactPhone', () => {
  it('adulto: só o número, sem marca', () => {
    const out = html({ lead: { name: 'Ana', whatsapp: '(51) 9 0000-1111' } });
    expect(out).toContain('(51) 9 0000-1111');
    expect(out).not.toContain('resp.');
  });

  it('menor: número do responsável com a marca resp.', () => {
    const out = html({ lead: { name: 'Pedro', whatsapp: '', isMinor: true, guardian: MAE } });
    expect(out).toContain('(11) 9 1234-5678');
    expect(out).toContain('resp.');
    expect(out).toContain('telefone do responsável');
  });

  it('showName: nome e parentesco antes do número', () => {
    const out = html({ lead: { name: 'Pedro', isMinor: true, guardian: MAE }, showName: true });
    expect(out).toContain('Maria Souza (mãe)');
  });

  it('sem telefone nenhum: não desenha nada', () => {
    expect(html({ lead: { name: 'Ana', whatsapp: '' } })).toBe('');
  });
});
