// Preenche a chave de casamento com o Stronizap (`zapMatchKey`) nos leads de
// uma academia que não a têm, ou que a têm diferente do WhatsApp gravado.
//
// O Stronizap acha a pessoa só por essa chave: o cartão da conversa, o
// `match` e a conferência de duplicado do cadastro pelo Stronizap. Lead criado
// antes de 08/09/2026 não tem o campo, então para o Stronizap ele não existe:
// o cartão diz "Sem cadastro" e o Cadastrar cria outro lead com o mesmo
// número. Foi o que aconteceu na Shape One em 08/10/2026, que conectou sozinha
// em 15/09 sem ninguém rodar a varredura. Por isso o `generate` do
// `api/zap.js` chama esta função antes de gravar a chave, e o
// `scripts/backfill-zap-match-key.js` usa a mesma.
//
// Primeiro uma leitura só dos dois campos, para achar quem muda. Depois uma
// transação por lote, que relê cada lead antes de gravar: o lead excluído no
// meio do caminho fica excluído (um `set` com merge o recriaria só com a
// chave) e o WhatsApp trocado no meio do caminho ganha a chave do número novo.
import { zapMatchKey } from './_zapPhone.js';

// Bem abaixo das 500 gravações que uma transação aceita.
export const FILL_BATCH = 400;

// A chave que o lead deveria ter, quando ela não é a gravada. null quando o
// lead já está certo ou não tem WhatsApp que dê chave.
const keyToWrite = (lead) => {
  const key = zapMatchKey(lead?.whatsapp);
  return key && key !== lead.zapMatchKey ? key : null;
};

export async function fillZapMatchKeys(db, leadsCol) {
  const snap = await leadsCol.select('whatsapp', 'zapMatchKey').get();
  const pending = snap.docs.filter((d) => keyToWrite(d.data())).map((d) => d.id);

  let updated = 0;
  for (let i = 0; i < pending.length; i += FILL_BATCH) {
    const refs = pending.slice(i, i + FILL_BATCH).map((id) => leadsCol.doc(id));
    // Cada chave vai para o lead pelo id do documento lido, nunca pela posição
    // na resposta do getAll.
    const refById = new Map(refs.map((ref) => [ref.id, ref]));
    updated += await db.runTransaction(async (tx) => {
      const docs = await tx.getAll(...refs);
      let written = 0;
      for (const doc of docs) {
        const key = doc.exists ? keyToWrite(doc.data()) : null;
        if (!key) continue;
        tx.update(refById.get(doc.id), { zapMatchKey: key });
        written += 1;
      }
      return written;
    });
  }
  return { read: snap.docs.length, updated };
}
