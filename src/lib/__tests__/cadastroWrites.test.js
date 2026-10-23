import { describe, it, expect, vi, beforeEach } from 'vitest';

const banco = vi.hoisted(() => ({ gravacoes: [], falhar: false }));
vi.mock('../firebase.js', () => ({ appId: 'acad', LEADS_PATH: 'leads' }));
vi.mock('firebase/firestore', () => ({
  doc: (...p) => ({ path: p.slice(1).join('/') }),
  updateDoc: async (ref, dados) => {
    if (banco.falhar) throw new Error('permission-denied');
    banco.gravacoes.push({ path: ref.path, dados });
  },
}));

const { saveCadastroSection } = await import('../cadastroWrites.js');
const { readSectionForm } = await import('../cadastroSections.js');

const LEAD = {
  id: 'l1', name: 'Marina Alves', whatsapp: '(51) 9 9530-4633', cpf: '03456789012',
  address: { street: 'Rua A', number: '10', city: 'Porto Alegre' },
  dor: 'Emagrecer', source: 'Instagram', consultantId: 'u1', consultantName: 'Júlia', tags: ['VIP'], observation: 'Treina de manhã.',
};

beforeEach(() => { banco.gravacoes = []; banco.falhar = false; });

describe('saveCadastroSection', () => {
  it('grava no documento do lead só as chaves da seção', async () => {
    const form = { maritalStatus: 'Casado(a)', profession: 'Fisioterapeuta' };
    await saveCadastroSection({ db: {}, lead: LEAD, sectionId: 'pessoais', form });
    expect(banco.gravacoes).toEqual([{
      path: 'artifacts/acad/public/data/leads/l1',
      dados: { maritalStatus: 'Casado(a)', profession: 'Fisioterapeuta' },
    }]);
  });

  it('a identidade não leva dor, origem, consultor, etiquetas, observação nem endereço', async () => {
    const form = { ...readSectionForm(LEAD, 'identidade'), rg: '6098765431' };
    await saveCadastroSection({ db: {}, lead: LEAD, sectionId: 'identidade', form });
    const dados = banco.gravacoes[0].dados;
    expect(dados.rg).toBe('6098765431');
    expect(dados.zapMatchKey).toBe('5195304633');
    ['dor', 'source', 'consultantId', 'consultantName', 'tags', 'observation', 'address'].forEach((k) => {
      expect(dados).not.toHaveProperty(k);
    });
  });

  it('o erro do Firestore sobe para quem chamou tratar', async () => {
    banco.falhar = true;
    await expect(saveCadastroSection({ db: {}, lead: LEAD, sectionId: 'pessoais', form: { maritalStatus: '', profession: '' } }))
      .rejects.toThrow('permission-denied');
    expect(banco.gravacoes).toEqual([]);
  });
});
