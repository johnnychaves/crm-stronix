import { describe, it, expect } from 'vitest';
import { zapMatchKey, nationalPhoneDigits } from '../_zapPhone.js';

describe('zapMatchKey', () => {
  it('reduz número com DDI e nono dígito', () => {
    expect(zapMatchKey('5551999998888')).toBe('5199998888');
  });

  it('reduz número com DDI e sem nono dígito ao mesmo valor', () => {
    expect(zapMatchKey('555199998888')).toBe('5199998888');
  });

  it('reduz número sem DDI', () => {
    expect(zapMatchKey('51999998888')).toBe('5199998888');
  });

  it('ignora máscara', () => {
    expect(zapMatchKey('(51) 9 9999-8888')).toBe('5199998888');
  });

  it('não confunde DDD 55 com DDI 55', () => {
    // Santa Maria/RS: 10 dígitos começando com 55, mas é DDD, não país.
    expect(zapMatchKey('5599998888')).toBe('5599998888');
  });

  it('devolve null para entrada vazia ou curta demais', () => {
    expect(zapMatchKey('')).toBeNull();
    expect(zapMatchKey(null)).toBeNull();
    expect(zapMatchKey('99998888')).toBeNull();
  });
});

describe('nationalPhoneDigits: o número no formato do Stronilead', () => {
  it('celular antigo, sem o nono dígito, ganha o 9 logo depois do DDD', () => {
    expect(nationalPhoneDigits('555181244710')).toBe('51981244710');
    expect(nationalPhoneDigits('5181244710')).toBe('51981244710');
    expect(nationalPhoneDigits('(51) 6123-4567')).toBe('51961234567');
  });

  it('celular com o nono dígito fica como está, sem o 55', () => {
    expect(nationalPhoneDigits('5551998124471')).toBe('51998124471');
    expect(nationalPhoneDigits('51998124471')).toBe('51998124471');
  });

  it('fixo (2 a 5 depois do DDD) fica com 10 dígitos', () => {
    expect(nationalPhoneDigits('555133334444')).toBe('5133334444');
    expect(nationalPhoneDigits('5152223333')).toBe('5152223333');
  });

  it('DDD 55 não é confundido com o país', () => {
    expect(nationalPhoneDigits('555599998888')).toBe('55999998888');
    expect(nationalPhoneDigits('5555999998888')).toBe('55999998888');
  });

  it('o que não vira 10 ou 11 dígitos volta null', () => {
    expect(nationalPhoneDigits('123')).toBeNull();
    expect(nationalPhoneDigits('')).toBeNull();
    expect(nationalPhoneDigits(null)).toBeNull();
    expect(nationalPhoneDigits('14155552671999')).toBeNull();
  });

  it('a chave de casamento é a mesma antes e depois', () => {
    ['555181244710', '5551998124471', '555133334444', '555599998888', '5181244710'].forEach((raw) => {
      expect(zapMatchKey(nationalPhoneDigits(raw))).toBe(zapMatchKey(raw));
    });
  });
});
