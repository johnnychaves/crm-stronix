// A frase grande do bloco Agora (visual da Meta do professor, 27/11/2026). O
// cenário é o dos outros testes dos textos: sexta, 16/10/2026, 14:32.
import { describe, it, expect } from 'vitest';
import { fraseOf } from '../metaFocoTexts.js';
import { taskKey } from '../metaFoco.js';
import { DAILY_GOAL_CATEGORIES as C } from '../leads.js';
import { FOCO_ESPERA } from '../metaFocoCodes.js';

const NOW = new Date(2026, 9, 16, 14, 32);
const at = (h, m = 0, dias = 0) => new Date(2026, 9, 16 + dias, h, m);
const entry = (lead, slug) => ({ key: taskKey(lead, slug), slug, lead });
// O texto como a tela mostra, com o negrito entre asteriscos e o vermelho com !.
const texto = (partes) => partes.map((p) => (typeof p === 'string' ? p : `*${p.b}${p.u ? '!' : ''}*`)).join('');

describe('fraseOf', () => {
  it('visita e aula: a que vai acontecer diz onde e com quem, e a que passou fica em vermelho', () => {
    expect(texto(fraseOf(entry({ id: 'v', appointmentType: 'visita', appointmentScheduledFor: at(15, 0), appointmentUnit: 'Centro' }, C.VISITA_HOJE), NOW)))
      .toBe('A visita é às *15:00*, na unidade Centro.');
    expect(texto(fraseOf(entry({ id: 'a', appointmentType: 'aula_experimental', appointmentScheduledFor: at(18, 0), appointmentProfessorName: 'Heloísa' }, C.AULA_HOJE), NOW)))
      .toBe('A aula experimental é às *18:00*, com Heloísa.');
    expect(texto(fraseOf(entry({ id: 'a2', appointmentType: 'aula_experimental', appointmentScheduledFor: at(10, 0) }, C.AULA_HOJE), NOW)))
      .toBe('A aula experimental era às *10:00!* e ainda está sem desfecho.');
  });

  it('contato diz o canal e a hora, e a hora que passou fica em vermelho', () => {
    expect(texto(fraseOf(entry({ id: 'c', nextFollowUp: at(15, 30), nextFollowUpType: 'Ligação' }, C.CONTATO_HOJE), NOW)))
      .toBe('Ligação combinada para hoje às *15:30*.');
    expect(texto(fraseOf(entry({ id: 'c2', nextFollowUp: at(9, 0), nextFollowUpType: 'Mensagem' }, C.CONTATO_HOJE), NOW)))
      .toBe('Mensagem combinada para as *09:00!*, e a hora já passou.');
  });

  it('lead novo diz quando sai da lista', () => {
    expect(texto(fraseOf(entry({ id: 'n', createdAt: at(21, 10, -1) }, C.NOVO_24H), NOW)))
      .toBe('Lead novo, ainda sem contato. Sai desta lista às *21:10*.');
  });

  it('atrasado: o crítico fica em vermelho, e o lead sem próximo passo diz isso', () => {
    expect(texto(fraseOf(entry({ id: 't', nextFollowUp: at(10, 0, -2) }, C.ATRASADO), NOW, { sla: 3 })))
      .toBe('O contato está atrasado há *2 dias*.');
    expect(texto(fraseOf(entry({ id: 't2', nextFollowUp: at(10, 0, -4) }, C.ATRASADO), NOW, { sla: 3 })))
      .toBe('O contato está atrasado há *4 dias!*.');
  });

  it('renovação, vencido e espera', () => {
    expect(texto(fraseOf(entry({ id: 'r', currentContractEndsAt: at(0, 0, 30) }, C.RENOVACAO), NOW)))
      .toBe('O contrato vence em *30 dias*.');
    expect(texto(fraseOf(entry({ id: 'x', currentContractEndsAt: new Date(2026, 9, 11) }, C.VENCIDO), NOW)))
      .toBe('O contrato venceu em *11/10/2026* e não foi renovado.');
    expect(texto(fraseOf(entry({ id: 'e', awaitingReplySince: at(14, 10) }, FOCO_ESPERA), NOW)))
      .toBe('Escreveu pelo Stronizap e espera resposta há *22 min*.');
  });
});
