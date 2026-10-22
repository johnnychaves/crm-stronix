import { describe, it, expect } from 'vitest';
import { lastRecordOf } from '../lastRecord.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const nota = (id, text, createdAt) => ({ id, _kind: 'note', type: 'note', text, createdAt });

describe('lastRecordOf', () => {
  it('sem registro de texto devolve null', () => {
    expect(lastRecordOf([])).toBeNull();
    expect(lastRecordOf(undefined)).toBeNull();
    expect(lastRecordOf([{ id: 'x', _kind: 'status', text: 'Fase alterada', createdAt: D(10, 1) }])).toBeNull();
  });

  it('anotação: tira o prefixo Obs e diz Anotação', () => {
    const r = lastRecordOf([nota('a', 'Obs: Pediu para ligar depois.', D(10, 14))]);
    expect(r).toEqual({ id: 'a', label: 'Anotação', date: D(10, 14), text: 'Pediu para ligar depois.' });
  });

  it('conversa de WhatsApp e de ligação saem com o rótulo certo e sem o emoji', () => {
    const zap = { id: 'w', _kind: 'conversation', text: '📲 Mensagem WhatsApp enviada: Enviei os valores', createdAt: D(10, 15) };
    const lig = { id: 'c', _kind: 'conversation', text: '📞 Ligação: Não atendeu', createdAt: D(10, 16) };
    expect(lastRecordOf([zap])).toMatchObject({ label: 'WhatsApp', text: 'Enviei os valores' });
    expect(lastRecordOf([lig])).toMatchObject({ label: 'Ligação', text: 'Não atendeu' });
  });

  it('pega o mais recente pela data, na ordem em que a lista vier', () => {
    const lista = [nota('velha', 'Obs: antiga.', D(10, 1)), nota('nova', 'Obs: recente.', D(10, 15)), nota('meio', 'Obs: do meio.', D(10, 8))];
    expect(lastRecordOf(lista).id).toBe('nova');
    expect(lastRecordOf([...lista].reverse()).id).toBe('nova');
  });

  it('ignora evento sem data e evento que não é texto', () => {
    const lista = [
      { id: 'semdata', _kind: 'note', text: 'Obs: sem data.' },
      { id: 'agenda', _kind: 'appointment', text: '🔔 Visita agendada', createdAt: D(10, 20) },
      nota('ok', 'Obs: valida.', D(10, 2)),
    ];
    expect(lastRecordOf(lista).id).toBe('ok');
  });

  it('a observação do cadastro também é uma anotação, sem o prefixo do cadastro', () => {
    const r = lastRecordOf([nota('o', 'OBSERVAÇÃO DO CADASTRO: Casamento em dezembro.', D(10, 3))]);
    expect(r.text).toBe('Casamento em dezembro.');
  });
});
