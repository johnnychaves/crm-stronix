import { describe, it, expect } from 'vitest';
import {
  MARITAL_STATUS_OPTIONS,
  readClientRegistration,
  buildClientRegistrationPatch,
  computeCompleteness,
  ownerChangeFor,
  ownerChangeNote,
} from '../clientRegistration.js';
import { classifyInteraction } from '../timeline.js';
import { buildLeadSearchFields } from '../leadDerived.js';

const baseForm = () => ({
  name: 'Marina Alves Ribeiro',
  whatsapp: '(51) 9 9530-4633',
  cpf: '034.567.890-12',
  rg: '6098765431',
  birthDate: '1994-03-12',
  sexo: 'Feminino',
  email: 'marina@email.com',
  dor: 'Emagrecer', modalidade: 'Musculação',
  cep: '90035-190', street: 'Rua Ramiro Barcelos', number: '1200',
  complement: 'Apto 502', neighborhood: 'Santana', city: 'Porto Alegre', state: 'RS',
  emgName: 'Rafael Ribeiro', emgPhone: '(51) 9 8811-2200', emgRelation: 'Cônjuge',
  maritalStatus: 'Casado(a)', profession: 'Fisioterapeuta',
  source: 'Indicação', consultantId: '', observation: 'Treina de manhã.', tags: ['VIP'],
});

describe('MARITAL_STATUS_OPTIONS', () => {
  it('tem as opções de estado civil', () => {
    expect(MARITAL_STATUS_OPTIONS).toContain('Solteiro(a)');
    expect(MARITAL_STATUS_OPTIONS).toContain('União estável');
  });
});

describe('buildClientRegistrationPatch', () => {
  it('monta o patch com identidade, mapas e campos de busca', () => {
    const patch = buildClientRegistrationPatch(baseForm(), { usersList: [] });
    expect(patch.name).toBe('Marina Alves Ribeiro');
    expect(patch.cpf).toBe('034.567.890-12');
    expect(patch.rg).toBe('6098765431');
    expect(patch.sexo).toBe('Feminino');
    expect(patch.email).toBe('marina@email.com');
    expect(patch.maritalStatus).toBe('Casado(a)');
    expect(patch.profession).toBe('Fisioterapeuta');
    expect(patch.birthDate instanceof Date).toBe(true);
    expect(patch.address).toEqual({
      cep: '90035-190', street: 'Rua Ramiro Barcelos', number: '1200',
      complement: 'Apto 502', neighborhood: 'Santana', city: 'Porto Alegre', state: 'RS',
    });
    expect(patch.emergencyContact).toEqual({
      name: 'Rafael Ribeiro', phone: '(51) 9 8811-2200', relationship: 'Cônjuge',
    });
    // Campos de busca recomputados (dual-write).
    expect(patch).toMatchObject(
      buildLeadSearchFields({ name: baseForm().name, whatsapp: baseForm().whatsapp, cpf: baseForm().cpf })
    );
  });

  it('vazio vira null e mapas vazios viram null', () => {
    const f = { ...baseForm(), rg: '', profession: '', cpf: '', email: '',
      cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
      emgName: '', emgPhone: '', emgRelation: '', birthDate: '' };
    const patch = buildClientRegistrationPatch(f, { usersList: [] });
    expect(patch.rg).toBeNull();
    expect(patch.profession).toBeNull();
    expect(patch.cpf).toBeNull();
    expect(patch.email).toBeNull();
    expect(patch.birthDate).toBeNull();
    expect(patch.address).toBeNull();
    expect(patch.emergencyContact).toBeNull();
  });

  it('qualquer um grava consultantName/authUid juntos (a regra exige o par)', () => {
    const f = { ...baseForm(), consultantId: 'u1' };
    const patch = buildClientRegistrationPatch(f, { usersList: [{ id: 'u1', name: 'Ana', authUid: 'a1' }] });
    expect(patch.consultantId).toBe('u1');
    expect(patch.consultantName).toBe('Ana');
    expect(patch.consultantAuthUid).toBe('a1');
  });

  it('consultor fora da lista não vira dono', () => {
    const f = { ...baseForm(), consultantId: 'fantasma' };
    const patch = buildClientRegistrationPatch(f, { usersList: [{ id: 'u1', name: 'Ana', authUid: 'a1' }] });
    expect('consultantId' in patch).toBe(false);
    expect('consultantAuthUid' in patch).toBe(false);
  });
});

describe('ownerChangeFor', () => {
  const ana = { id: 'u1', name: 'Ana', authUid: 'a1' };
  const patchPara = (consultantId) =>
    buildClientRegistrationPatch({ ...baseForm(), consultantId }, { usersList: [ana] });

  it('devolve null quando o dono não muda', () => {
    expect(ownerChangeFor({ consultantId: 'u1', consultantName: 'Ana' }, patchPara('u1'))).toBeNull();
  });

  it('devolve null quando o patch não mexe no dono', () => {
    expect(ownerChangeFor({ consultantId: 'u1' }, patchPara(''))).toBeNull();
  });

  it('descreve a troca com os dois nomes', () => {
    const c = ownerChangeFor({ consultantId: 'u2', consultantName: 'Bruno' }, patchPara('u1'));
    expect(c).toEqual({ fromId: 'u2', fromName: 'Bruno', toId: 'u1', toName: 'Ana' });
  });

  it('lead sem dono vira troca a partir de "sem responsável"', () => {
    const c = ownerChangeFor({}, patchPara('u1'));
    expect(c.fromId).toBeNull();
    expect(c.fromName).toBe('sem responsável');
  });

  it('a nota não bate no regex de contrato da timeline', () => {
    const nota = ownerChangeNote(ownerChangeFor({ consultantId: 'u2', consultantName: 'Bruno' }, patchPara('u1')));
    expect(nota).toBe('Responsável alterado de [Bruno] para [Ana].');
    expect(classifyInteraction({ type: 'status_change', text: nota })).toBe('status');
  });
});

describe('readClientRegistration', () => {
  it('lê um lead com mapas para o form (mascarando cpf/telefone)', () => {
    const lead = {
      name: 'Marina', whatsapp: '(51) 9 9530-4633', cpf: '03456789012', rg: '6098765431',
      sexo: 'Feminino', email: 'm@e.com', maritalStatus: 'Casado(a)', profession: 'Fisio',
      birthDate: null, source: 'Indicação', consultantId: 'u1', observation: 'oi', tags: ['VIP'],
      address: { cep: '90035190', street: 'Rua X', number: '10', complement: '', neighborhood: 'Y', city: 'POA', state: 'RS' },
      emergencyContact: { name: 'Rafa', phone: '51988112200', relationship: 'Cônjuge' },
    };
    const form = readClientRegistration(lead);
    expect(form.name).toBe('Marina');
    expect(form.cpf).toBe('034.567.890-12');
    expect(form.emgPhone).toBe('(51) 9 8811-2200');
    expect(form.street).toBe('Rua X');
    expect(form.emgRelation).toBe('Cônjuge');
    expect(form.tags).toEqual(['VIP']);
  });

  it('lead sem os campos novos não quebra (defaults vazios)', () => {
    const form = readClientRegistration({ name: 'João', whatsapp: '5199999' });
    expect(form.rg).toBe('');
    expect(form.city).toBe('');
    expect(form.emgName).toBe('');
    expect(form.tags).toEqual([]);
  });
});

describe('computeCompleteness', () => {
  it('form cheio ~100% e vazio ~0%', () => {
    expect(computeCompleteness(baseForm())).toBeGreaterThanOrEqual(90);
    const empty = readClientRegistration({ name: 'Só Nome' });
    expect(computeCompleteness(empty)).toBeLessThan(20);
  });
});

describe('professor responsável', () => {
  it('resolve professorName pela lista de professores', () => {
    const patch = buildClientRegistrationPatch({ ...baseForm(), professorId: 'p1' }, { professores: [{ id: 'p1', nome: 'Prof. Léo' }] });
    expect(patch.professorId).toBe('p1');
    expect(patch.professorName).toBe('Prof. Léo');
  });
  it('sem professor -> professorId e professorName null', () => {
    const patch = buildClientRegistrationPatch(baseForm(), { professores: [] });
    expect(patch.professorId).toBeNull();
    expect(patch.professorName).toBeNull();
  });
  it('lê professorId do lead', () => {
    expect(readClientRegistration({ professorId: 'p9' }).professorId).toBe('p9');
  });
});

describe('dor e modalidade', () => {
  it('patch mapeia dor e modalidade do form', () => {
    const patch = buildClientRegistrationPatch({ ...baseForm() }, {});
    expect(patch.dor).toBe('Emagrecer');
    expect(patch.modalidade).toBe('Musculação');
  });

  it('vazio vira null', () => {
    const patch = buildClientRegistrationPatch({ ...baseForm(), dor: '', modalidade: '' }, {});
    expect(patch.dor).toBeNull();
    expect(patch.modalidade).toBeNull();
  });

  it('readClientRegistration lê dor e modalidade do lead', () => {
    const form = readClientRegistration({ dor: 'X', modalidade: 'Y' });
    expect(form.dor).toBe('X');
    expect(form.modalidade).toBe('Y');
  });
});
