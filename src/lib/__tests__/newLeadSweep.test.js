// O Novo lead e o cadastro pelo Stronizap gravam o lead pelo mesmo montador
// (src/lib/newLead.js). Esta varredura lê o código dos dois e reprova quem
// voltar a montar o documento na mão: um campo novo só chega aos dois
// cadastros se os dois passarem pelo montador.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('os dois cadastros de lead usam o mesmo montador', () => {
  it('o Novo lead grava só o montador e as duas datas do servidor', () => {
    const modal = ler('../../modals/AddLeadModal.jsx');
    // Do "await addDoc(" até a linha que só fecha a chamada.
    const chamada = /await addDoc\(([\s\S]*?)\n\s*\);/.exec(modal);
    expect(chamada).not.toBeNull();
    const corpo = chamada[1];
    const espalhados = [...corpo.matchAll(/\.\.\.(\w+)\(/g)].map((m) => m[1]);
    const chaves = [...corpo.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
    expect(espalhados).toEqual(['buildNewLeadDoc']);
    expect(chaves).toEqual(['createdAt', 'statusEnteredAt']);
  });

  it('a ponte monta o lead novo pelo mesmo montador', () => {
    const ponte = ler('../../../api/_zapLead.js');
    expect(ponte).toMatch(/\.\.\.buildNewLeadDoc\(/);
    expect(ponte).not.toMatch(/buildLeadSearchFields|buildGuardianPatch|getLeadOwnershipFields|deriveLeadBucket/);
  });
});
