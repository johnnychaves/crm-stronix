import { describe, it, expect } from 'vitest';
import { phoneNoticeLines } from '../phoneNotice.js';

const HOJE = new Date(2026, 8, 24, 10, 0);
const MAE = { name: 'Maria', phone: '(11) 9 1234-5678', relationship: 'Mãe' };
const filho = (name, extra = {}) => ({ id: name, name, isMinor: true, guardian: MAE, birthDate: new Date(2015, 1, 1), ...extra });

describe('phoneNoticeLines', () => {
  it('campo do responsável: telefone de um cliente', () => {
    const owner = { id: 'm', name: 'Maria Silva', lifecycleStage: 'cliente' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [], now: HOJE }))
      .toEqual(['Esse é o telefone de Maria Silva, cliente.']);
  });

  it('campo do responsável: telefone de um lead, com a etapa', () => {
    const owner = { id: 'm', name: 'Maria Silva', status: 'Negociação' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [], now: HOJE }))
      .toEqual(['Esse é o telefone de Maria Silva, lead em Negociação.']);
  });

  it('campo do responsável: já é responsável de outros menores', () => {
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [filho('Ana Souza')], now: HOJE }))
      .toEqual(['Maria já é responsável de Ana.']);
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [filho('Ana Souza'), filho('Pedro Souza'), filho('Lia Souza')], now: HOJE }))
      .toEqual(['Maria já é responsável de Ana, Pedro e mais 1.']);
  });

  it('campo do próprio lead: o telefone é de um responsável', () => {
    expect(phoneNoticeLines({ field: 'own', owner: null, wards: [filho('Ana Souza'), filho('Pedro Souza')], now: HOJE }))
      .toEqual(['Esse telefone é de Maria, responsável de Ana e Pedro.']);
  });

  it('campo do próprio lead: dono do número não gera aviso (quem barra é o duplicado)', () => {
    const owner = { id: 'm', name: 'Maria Silva', lifecycleStage: 'cliente' };
    expect(phoneNoticeLines({ field: 'own', owner, wards: [], now: HOJE })).toEqual([]);
  });

  it('menor que fez 18 com WhatsApp próprio não conta mais como filho', () => {
    const adulto = filho('Ana Souza', { birthDate: new Date(2008, 0, 1), whatsapp: '(11) 9 5555-4444' });
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [adulto], now: HOJE })).toEqual([]);
  });

  it('dono e menores juntos: as duas linhas, dono primeiro', () => {
    const owner = { id: 'm', name: 'Maria Silva', lifecycleStage: 'cliente' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [filho('Ana Souza')], now: HOJE })).toEqual([
      'Esse é o telefone de Maria Silva, cliente.',
      'Maria já é responsável de Ana.',
    ]);
  });

  it('dono sem etapa nem lifecycle: "lead" sem complemento', () => {
    const owner = { id: 'm', name: 'Maria Silva' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [], now: HOJE }))
      .toEqual(['Esse é o telefone de Maria Silva, lead.']);
  });

  it('campo do responsável sem o nome do responsável: sem sujeito', () => {
    const semNome = filho('Ana Souza', { guardian: { ...MAE, name: '' } });
    expect(phoneNoticeLines({ field: 'guardian', owner: null, wards: [semNome], now: HOJE }))
      .toEqual(['Já é responsável de Ana.']);
  });

  it('campo do próprio lead sem o nome do responsável', () => {
    const semNome = filho('Ana Souza', { guardian: { ...MAE, name: '' } });
    expect(phoneNoticeLines({ field: 'own', owner: null, wards: [semNome], now: HOJE }))
      .toEqual(['Esse telefone é do responsável de Ana.']);
  });

  it('dono que também é um dos menores: só a linha do menor', () => {
    const owner = { id: 'Ana Souza', name: 'Ana Souza', lifecycleStage: 'cliente' };
    expect(phoneNoticeLines({ field: 'guardian', owner, wards: [filho('Ana Souza')], now: HOJE }))
      .toEqual(['Maria já é responsável de Ana.']);
  });

  it('campo do próprio lead com menor que já fez 18 e tem WhatsApp próprio: sem aviso', () => {
    const adulto = filho('Ana Souza', { birthDate: new Date(2008, 0, 1), whatsapp: '(11) 9 5555-4444' });
    expect(phoneNoticeLines({ field: 'own', owner: null, wards: [adulto], now: HOJE })).toEqual([]);
  });
});
