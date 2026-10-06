// O dono do lead gravado numa interação (leadConsultantId e
// leadConsultantAuthUid) é o dono no dia do fato, e nunca é regravado depois.
// Decisão do Johnny em 06/10/2026: o crédito por pessoa é do dono do lead no
// dia do fato. Até ali a migração de carteira (Configurações → Migrar leads)
// relia a coleção inteira de interações e trocava esses dois campos em todas
// as interações dos leads migrados, de qualquer data, e cada migração apagava
// de vez quem era o responsável na época. Ninguém filtra interação por esses
// campos: a ficha lê a linha do tempo pelo id do lead, e o único leitor é a
// reserva de autor da Meta e do Operacional (interactionOwnerAuthUid, em
// src/lib/dailyGoal.js). Esta varredura reprova quem voltar a regravar.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));

function arquivosDeCodigo(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') out.push(...arquivosDeCodigo(full));
    } else if (/\.jsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// Quem CRIA a interação grava o dono do lead nela. São os únicos lugares onde
// esses campos podem aparecer como chave de objeto: a função central que o
// logInteraction e os outros gravadores usam, e os dois que montam a
// interação à mão (o evento da importação e os dois da indicação pública).
const CRIAM_A_INTERACAO = [
  'src/lib/leads.js',
  'src/lib/clientImportWrites.js',
  'api/tenant-resolve.js',
];

const GRAVA_DONO = /\bleadConsultant(?:Id|AuthUid)\s*:/;

describe('o dono do lead na interação é o do dia do fato', () => {
  it('a migração de carteira não regrava o dono nas interações antigas', () => {
    const tela = readFileSync(join(RAIZ, 'src/views/settings/TransferLeadsTab.jsx'), 'utf8');
    expect(tela).not.toMatch(/leadConsultant(?:Id|AuthUid)/);
    // Nem relê a coleção de interações: era só para regravar.
    expect(tela).not.toMatch(/getDocs\([^;]*INTERACTIONS_PATH/);
  });

  it('só quem cria a interação grava o dono do lead nela', () => {
    const gravam = ['src', 'api', 'scripts']
      .flatMap((pasta) => arquivosDeCodigo(join(RAIZ, pasta)))
      .filter((file) => GRAVA_DONO.test(readFileSync(file, 'utf8')))
      .map((file) => relative(RAIZ, file))
      .sort();
    expect(gravam).toEqual([...CRIAM_A_INTERACAO].sort());
  });
});
