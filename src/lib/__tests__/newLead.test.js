// O montador do lead novo (src/lib/newLead.js) nasceu do handleSubmit do Novo
// lead (AddLeadModal.jsx). Estes testes travam os campos que o Novo lead
// gravava antes da extração, valor por valor: o cadastro pelo Stronizap usa o
// mesmo montador, então um campo que mudar aqui muda nos dois cadastros.
import { describe, it, expect } from 'vitest';
import { buildNewLeadDoc, leadEntryFunnels } from '../newLead.js';

const ANA = { id: 'u-ana', name: 'Ana Souza', authUid: 'auth-ana', role: 'consultant', email: 'ana@stronix.com.br' };

// O formulário do Novo lead, como o AddLeadModal guarda no estado.
const ADULTO = {
  name: '  Ana Lima  ',
  whatsapp: '(51) 9 9812-4471',
  isMinor: false,
  guardianName: '',
  guardianPhone: '',
  guardianRelation: '',
  source: 'WhatsApp',
  funnelId: 'f-com',
  status: 'Novo lead',
  tags: ['Quente'],
  dor: ' Postura ',
  modalidade: 'Pilates',
  birthDate: '1990-05-10',
  cpf: ' 123.456.789-01 ',
  sexo: 'Feminino',
  email: ' ana@exemplo.com ',
  observation: 'não vai para o documento do lead',
};

describe('buildNewLeadDoc: os campos que o Novo lead grava', () => {
  it('adulto: cada campo, com o mesmo valor que o AddLeadModal gravava', () => {
    expect(buildNewLeadDoc(ADULTO, { owner: ANA })).toEqual({
      name: 'Ana Lima',
      whatsapp: '(51) 9 9812-4471',
      source: 'WhatsApp',
      funnelId: 'f-com',
      status: 'Novo lead',
      tags: ['Quente'],
      birthDate: new Date(1990, 4, 10),
      cpf: '123.456.789-01',
      email: 'ana@exemplo.com',
      sexo: 'Feminino',
      dor: 'Postura',
      modalidade: 'Pilates',
      referredById: null,
      referredByName: null,
      consultantId: 'u-ana',
      consultantName: 'Ana Souza',
      consultantAuthUid: 'auth-ana',
      // Os campos de busca recebem o nome sem aparar, como antes.
      nameLower: '  ana lima  ',
      nameTokens: ['ana', 'lima'],
      whatsappDigits: '51998124471',
      whatsappDigitsRev: '17442189915',
      cpfDigits: '12345678901',
      zapMatchKey: '5198124471',
      isMinor: false,
      guardian: null,
      guardianPhoneDigits: null,
      guardianPhoneDigitsRev: null,
      guardianZapMatchKey: null,
      lifecycleBucket: 'ativo',
      lastInteractionAt: null,
      interactionsCount: 0,
      nextFollowUp: null,
      nextFollowUpType: null,
      appointmentType: null,
      appointmentScheduledFor: null,
    });
  });

  it('menor: o bloco do responsável e o WhatsApp do aluno em branco', () => {
    const menor = {
      ...ADULTO,
      name: 'Pedro Souza',
      whatsapp: '',
      isMinor: true,
      guardianName: ' Maria Souza ',
      guardianPhone: '(51) 9 9812-4471',
      guardianRelation: 'Mãe',
      tags: [],
      dor: 'Postura',
      modalidade: '',
      birthDate: '',
      cpf: '',
      sexo: '',
      email: '',
    };
    expect(buildNewLeadDoc(menor, { owner: ANA })).toMatchObject({
      name: 'Pedro Souza',
      whatsapp: '',
      birthDate: null,
      cpf: null,
      email: null,
      sexo: null,
      modalidade: null,
      nameLower: 'pedro souza',
      whatsappDigits: '',
      whatsappDigitsRev: '',
      cpfDigits: '',
      zapMatchKey: null,
      isMinor: true,
      guardian: { name: 'Maria Souza', phone: '(51) 9 9812-4471', relationship: 'Mãe' },
      guardianPhoneDigits: '51998124471',
      guardianPhoneDigitsRev: '17442189915',
      guardianZapMatchKey: '5198124471',
    });
  });

  it('indicação: o vínculo vai no próprio documento; indicador sem nome fica com o nome null', () => {
    const doc = buildNewLeadDoc({ ...ADULTO, source: 'Indicação' }, { owner: ANA, referrer: { id: 'c9', name: 'Carla' } });
    expect(doc).toMatchObject({ referredById: 'c9', referredByName: 'Carla' });
    expect(buildNewLeadDoc(ADULTO, { owner: ANA, referrer: { id: 'c9', name: '' } }).referredByName).toBeNull();
  });

  it('as datas do servidor ficam com quem grava', () => {
    const doc = buildNewLeadDoc(ADULTO, { owner: ANA });
    expect('createdAt' in doc).toBe(false);
    expect('statusEnteredAt' in doc).toBe(false);
  });

  it('campo que não veio ganha o valor vazio que o Novo lead grava', () => {
    const doc = buildNewLeadDoc(
      { name: 'Mariana Souza', whatsapp: '(51) 9 9812-4471', source: 'WhatsApp', funnelId: 'f-com', status: 'Novo lead', dor: 'Postura' },
      { owner: ANA }
    );
    expect(doc).toMatchObject({
      tags: [], birthDate: null, cpf: null, email: null, sexo: null, modalidade: null,
      referredById: null, referredByName: null, isMinor: false, guardian: null,
    });
    expect(Object.values(doc)).not.toContain(undefined);
  });

  it('etapa de venda nasce no balde cliente, como no Novo lead', () => {
    expect(buildNewLeadDoc({ ...ADULTO, status: 'Venda' }, { owner: ANA }).lifecycleBucket).toBe('cliente');
  });
});

describe('leadEntryFunnels: onde um lead novo pode nascer pela escolha de funil', () => {
  it('tira Indicações, Renovações, Vencidos e Upgrade pelo systemKind, nunca pelo nome', () => {
    const funis = [
      { id: 'a', name: 'Comercial' },
      { id: 'b', name: 'Indicações', systemKind: 'referral' },
      { id: 'c', name: 'Renovações', systemKind: 'renewal' },
      { id: 'd', name: 'Vencidos', systemKind: 'expired' },
      { id: 'e', name: 'Upgrade', systemKind: 'upgrade' },
      // Funil da própria academia com o nome de um funil de sistema.
      { id: 'f', name: 'Renovações' },
    ];
    expect(leadEntryFunnels(funis).map((f) => f.id)).toEqual(['a', 'f']);
  });

  it('lista ausente vira lista vazia', () => {
    expect(leadEntryFunnels(null)).toEqual([]);
    expect(leadEntryFunnels(undefined)).toEqual([]);
  });
});
