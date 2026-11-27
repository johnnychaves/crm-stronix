import { describe, it, expect } from 'vitest';
import { diaTexto, periodoTexto, prazoTexto } from '../../views/professores/pesquisasTexto.js';

describe('textos da pesquisa', () => {
  it('datas e ciclo', () => {
    expect(diaTexto('2027-06-01')).toBe('01/06/2027');
    expect(diaTexto('')).toBe('');
    expect(periodoTexto('2027-06-01', '2027-06-20')).toBe('01/06 a 20/06/2027');
    expect(periodoTexto('2027-12-20', '2028-01-05')).toBe('20/12/2027 a 05/01/2028');
  });

  it('prazo da aberta', () => {
    const p = { inicio: '2027-06-01', fim: '2027-06-20' };
    expect(prazoTexto(p, '2027-05-30')).toBe('recebe respostas a partir de 01/06');
    expect(prazoTexto(p, '2027-06-14')).toBe('faltam 6 dias');
    expect(prazoTexto(p, '2027-06-19')).toBe('falta 1 dia');
    expect(prazoTexto(p, '2027-06-20')).toBe('termina hoje');
  });
});
