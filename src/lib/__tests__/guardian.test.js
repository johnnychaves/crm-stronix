import { describe, it, expect } from 'vitest';
import {
  GUARDIAN_RELATIONSHIPS, adultSince, turnedAdult, isMinorNow, contactOf, contactLabel,
  firstName, whatsappHref, telHref, guardianIssue,
} from '../guardian.js';

const HOJE = new Date(2026, 8, 24, 10, 0);
const MAE = { name: 'Maria Souza', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const menor = (extra = {}) => ({
  name: 'Pedro Souza', whatsapp: '', isMinor: true, guardian: MAE, birthDate: new Date(2015, 4, 10), ...extra,
});

describe('adultSince', () => {
  it('é o aniversário de 18 anos, à meia-noite local', () => {
    expect(adultSince(new Date(2009, 2, 12))).toEqual(new Date(2027, 2, 12));
  });
  it('29 de fevereiro vira 1º de março em ano que não é bissexto', () => {
    expect(adultSince(new Date(2008, 1, 29))).toEqual(new Date(2026, 2, 1));
  });
  it('aceita Timestamp do Firestore e devolve null sem data', () => {
    expect(adultSince({ toDate: () => new Date(2009, 2, 12) })).toEqual(new Date(2027, 2, 12));
    expect(adultSince(null)).toBeNull();
  });
});

describe('turnedAdult e isMinorNow', () => {
  it('menor com data antes dos 18: é menor agora', () => {
    expect(isMinorNow(menor(), HOJE)).toBe(true);
    expect(turnedAdult(menor(), HOJE)).toBe(false);
  });
  it('sem data de nascimento: segue menor até alguém desligar', () => {
    expect(isMinorNow(menor({ birthDate: null }), HOJE)).toBe(true);
  });
  it('vira adulto no dia do aniversário, não antes', () => {
    const lead = menor({ birthDate: new Date(2008, 8, 24) });
    expect(turnedAdult(lead, new Date(2026, 8, 23, 23, 59))).toBe(false);
    expect(turnedAdult(lead, new Date(2026, 8, 24, 0, 0))).toBe(true);
    expect(isMinorNow(lead, new Date(2026, 8, 24, 0, 0))).toBe(false);
  });
  it('chave desligada ou sem telefone do responsável: não é menor', () => {
    expect(isMinorNow(menor({ isMinor: false }), HOJE)).toBe(false);
    expect(isMinorNow(menor({ guardian: { ...MAE, phone: '123' } }), HOJE)).toBe(false);
    expect(isMinorNow(menor({ guardian: null }), HOJE)).toBe(false);
  });
});

describe('contactOf', () => {
  it('menor: o contato é o responsável', () => {
    expect(contactOf(menor({ whatsapp: '(11) 9 5555-4444' }), HOJE)).toEqual({
      phone: MAE.phone, name: 'Maria Souza', relationship: 'Mãe', viaGuardian: true, missingOwnPhone: false,
    });
  });
  it('fez 18 sem WhatsApp próprio: segue o responsável, com o aviso', () => {
    const c = contactOf(menor({ birthDate: new Date(2008, 0, 1) }), HOJE);
    expect(c.viaGuardian).toBe(true);
    expect(c.missingOwnPhone).toBe(true);
  });
  it('fez 18 com WhatsApp próprio: o próprio lead', () => {
    const c = contactOf(menor({ birthDate: new Date(2008, 0, 1), whatsapp: '(11) 9 5555-4444' }), HOJE);
    expect(c).toEqual({ phone: '(11) 9 5555-4444', name: 'Pedro Souza', relationship: null, viaGuardian: false, missingOwnPhone: false });
  });
  it('adulto comum: o próprio lead, como hoje', () => {
    expect(contactOf({ name: 'Ana', whatsapp: '(51) 9 0000-1111' }, HOJE).phone).toBe('(51) 9 0000-1111');
    expect(contactOf(null, HOJE).phone).toBe('');
  });
});

describe('textos e links', () => {
  it('contactLabel: nome e parentesco em minúscula; Outro e vazio só o nome', () => {
    expect(contactLabel({ name: 'Maria Souza', relationship: 'Mãe' })).toBe('Maria Souza (mãe)');
    expect(contactLabel({ name: 'Maria Souza', relationship: 'Outro' })).toBe('Maria Souza');
    expect(contactLabel({ name: 'Maria Souza', relationship: null })).toBe('Maria Souza');
  });
  it('firstName', () => {
    expect(firstName('  Maria Souza ')).toBe('Maria');
    expect(firstName('')).toBe('');
  });
  it('whatsappHref põe o 55 em número de até 11 dígitos e codifica o texto', () => {
    expect(whatsappHref('(11) 9 1234-5678')).toBe('https://wa.me/5511912345678');
    expect(whatsappHref('5511912345678', 'Olá Maria')).toBe('https://wa.me/5511912345678?text=Ol%C3%A1%20Maria');
    expect(whatsappHref('')).toBeNull();
  });
  it('telHref', () => {
    expect(telHref('(11) 9 1234-5678')).toBe('tel:11912345678');
    expect(telHref('')).toBeNull();
  });
  it('lista de parentesco fixa', () => {
    expect(GUARDIAN_RELATIONSHIPS).toEqual(['Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio', 'Outro']);
  });
});

describe('guardianIssue', () => {
  const ok = { isMinor: true, name: 'Maria', phone: '(11) 9 1234-5678', birthDate: new Date(2015, 4, 10), now: HOJE };
  it('chave desligada: nada a validar', () => {
    expect(guardianIssue({ ...ok, isMinor: false, name: '' })).toBeNull();
  });
  it('tudo certo: null', () => {
    expect(guardianIssue(ok)).toBeNull();
    expect(guardianIssue({ ...ok, birthDate: null })).toBeNull();
  });
  it('nome, telefone e data de quem já tem 18', () => {
    expect(guardianIssue({ ...ok, name: 'M' })).toBe('Informe o nome do responsável.');
    expect(guardianIssue({ ...ok, phone: '(11) 9 12' })).toBe('Informe o telefone do responsável com DDD.');
    expect(guardianIssue({ ...ok, birthDate: new Date(2008, 0, 1) }))
      .toBe('Pela data, já tem 18 anos. Confira a data ou desligue a chave.');
  });
});
