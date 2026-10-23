import { describe, it, expect } from 'vitest';
import {
  CADASTRO_SECTIONS, readSectionForm, buildSectionPatch, sectionIssue,
  missingOf, shortcutFieldOf, sectionStatus, missingHeadline, headlineOf, isComplete, joinList, capFirst, ageOf, viewRowsOf,
} from '../cadastroSections.js';
import { readClientRegistration } from '../clientRegistration.js';

const HOJE = new Date(2026, 5, 1, 12);
const LEAD = {
  id: 'l1', name: 'Marina Alves', whatsapp: '(51) 9 9530-4633', cpf: '03456789012',
  email: 'marina@email.com', birthDate: new Date(1994, 2, 12, 12),
  address: { cep: '90035-190', street: 'Rua Ramiro Barcelos', number: '1200', complement: 'Apto 502', neighborhood: 'Santana', city: 'Porto Alegre', state: 'RS' },
  emergencyContact: { name: 'Rafael', phone: '(51) 9 8811-2200', relationship: 'Cônjuge' },
  profession: 'Fisioterapeuta',
  dor: 'Emagrecer', source: 'Instagram', consultantId: 'u1', consultantName: 'Júlia', tags: ['VIP'], observation: 'Treina de manhã.',
};
const IDENTIDADE_PATCH = [
  'name', 'whatsapp', 'cpf', 'rg', 'birthDate', 'sexo', 'email',
  'nameLower', 'nameTokens', 'whatsappDigits', 'whatsappDigitsRev', 'cpfDigits', 'zapMatchKey',
  'isMinor', 'guardian', 'guardianPhoneDigits', 'guardianPhoneDigitsRev', 'guardianZapMatchKey',
];

describe('CADASTRO_SECTIONS', () => {
  it('são quatro, na ordem da aba', () => {
    expect(CADASTRO_SECTIONS.map((s) => s.id)).toEqual(['identidade', 'endereco', 'emergencia', 'pessoais']);
    expect(CADASTRO_SECTIONS.map((s) => s.title)).toEqual(['Identidade', 'Endereço', 'Contato de emergência', 'Dados pessoais']);
  });
});

describe('readSectionForm', () => {
  it('traz só as chaves da seção, lidas do lead', () => {
    const f = readSectionForm(LEAD, 'endereco', HOJE);
    expect(Object.keys(f)).toEqual(['cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state']);
    expect(f.street).toBe('Rua Ramiro Barcelos');
    expect(readSectionForm(LEAD, 'pessoais', HOJE)).toEqual({ maritalStatus: '', profession: 'Fisioterapeuta' });
  });

  it('a identidade leva a chave de menor, o responsável e o estado de quando abriu', () => {
    const f = readSectionForm(LEAD, 'identidade', HOJE);
    expect(Object.keys(f)).toEqual([
      'name', 'whatsapp', 'cpf', 'rg', 'birthDate', 'sexo', 'email',
      'isMinor', 'minorAtOpen', 'adultSince', 'guardianName', 'guardianPhone', 'guardianRelation',
    ]);
    expect(f.cpf).toBe('034.567.890-12');
    expect(f.birthDate).toBe('1994-03-12');
  });

  it('nunca traz dor, origem, consultor, professor, etiquetas nem observação', () => {
    const todas = CADASTRO_SECTIONS.flatMap((s) => Object.keys(readSectionForm(LEAD, s.id, HOJE)));
    ['dor', 'modalidade', 'source', 'consultantId', 'professorId', 'tags', 'observation'].forEach((k) => {
      expect(todas).not.toContain(k);
    });
  });
});

describe('buildSectionPatch', () => {
  it('endereço grava só o address', () => {
    const f = { ...readSectionForm(LEAD, 'endereco', HOJE), city: 'Canoas' };
    const patch = buildSectionPatch('endereco', f, LEAD, HOJE);
    expect(Object.keys(patch)).toEqual(['address']);
    expect(patch.address.city).toBe('Canoas');
    expect(patch.address.street).toBe('Rua Ramiro Barcelos');
  });

  it('endereço todo apagado grava address nulo', () => {
    const vazio = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
    expect(buildSectionPatch('endereco', vazio, LEAD, HOJE)).toEqual({ address: null });
  });

  it('emergência grava só o emergencyContact', () => {
    const f = { ...readSectionForm(LEAD, 'emergencia', HOJE), emgRelation: 'Marido' };
    const patch = buildSectionPatch('emergencia', f, LEAD, HOJE);
    expect(Object.keys(patch)).toEqual(['emergencyContact']);
    expect(patch.emergencyContact).toEqual({ name: 'Rafael', phone: '(51) 9 8811-2200', relationship: 'Marido' });
  });

  it('dados pessoais gravam estado civil e profissão, e vazio vira nulo', () => {
    const patch = buildSectionPatch('pessoais', { maritalStatus: '', profession: 'Fisioterapeuta' }, LEAD, HOJE);
    expect(patch).toEqual({ maritalStatus: null, profession: 'Fisioterapeuta' });
  });

  it('identidade grava os campos dela, os derivados de busca e o responsável, e nada mais', () => {
    const f = { ...readSectionForm(LEAD, 'identidade', HOJE), rg: '6098765431' };
    const patch = buildSectionPatch('identidade', f, LEAD, HOJE);
    expect(Object.keys(patch).sort()).toEqual([...IDENTIDADE_PATCH].sort());
    expect(patch.rg).toBe('6098765431');
    expect(patch.zapMatchKey).toBe('5195304633');
    expect(patch.isMinor).toBe(false);
    expect(patch.guardian).toBeNull();
    ['address', 'emergencyContact', 'dor', 'source', 'consultantId', 'consultantName', 'consultantAuthUid',
      'professorId', 'professorName', 'tags', 'observation', 'maritalStatus', 'profession'].forEach((k) => {
      expect(patch).not.toHaveProperty(k);
    });
  });

  it('menor de idade grava o responsável', () => {
    const menor = {
      id: 'l2', name: 'Pedro Costa', whatsapp: '', isMinor: true, birthDate: new Date(2016, 0, 10, 12),
      guardian: { name: 'Ana Costa', phone: '(11) 9 5555-4444', relationship: 'Mãe' },
    };
    const f = readSectionForm(menor, 'identidade', HOJE);
    expect(f.isMinor).toBe(true);
    const patch = buildSectionPatch('identidade', f, menor, HOJE);
    expect(patch.isMinor).toBe(true);
    expect(patch.guardian).toEqual({ name: 'Ana Costa', phone: '(11) 9 5555-4444', relationship: 'Mãe' });
    expect(patch.guardianZapMatchKey).toBe('1155554444');
  });

  it('quem fez 18 anos sem WhatsApp próprio não tem o responsável tocado', () => {
    const adulto = {
      id: 'l3', name: 'Pedro Costa', whatsapp: '', isMinor: true, birthDate: new Date(2008, 2, 12, 12),
      guardian: { name: 'Ana Costa', phone: '(11) 9 5555-4444', relationship: 'Mãe' },
    };
    const f = readSectionForm(adulto, 'identidade', HOJE);
    expect(f.adultSince).toBe('2026-03-12');
    const patch = buildSectionPatch('identidade', f, adulto, HOJE);
    expect(patch).not.toHaveProperty('guardian');
    expect(patch).not.toHaveProperty('isMinor');
  });

  it('seção desconhecida é erro, não gravação vazia', () => {
    expect(() => buildSectionPatch('relacionamento', {}, LEAD, HOJE)).toThrow(/relacionamento/);
  });
});

describe('sectionIssue', () => {
  it('a identidade pede o nome', () => {
    const f = readSectionForm(LEAD, 'identidade', HOJE);
    expect(sectionIssue('identidade', { ...f, name: '  ' }, HOJE)).toBe('Informe o nome.');
    expect(sectionIssue('identidade', f, HOJE)).toBeNull();
  });

  it('menor sem responsável não passa, e as outras seções nunca barram', () => {
    const f = { ...readSectionForm(LEAD, 'identidade', HOJE), isMinor: true, guardianName: '', guardianPhone: '' };
    expect(sectionIssue('identidade', f, HOJE)).toBeTruthy();
    expect(sectionIssue('endereco', {}, HOJE)).toBeNull();
    expect(sectionIssue('emergencia', {}, HOJE)).toBeNull();
    expect(sectionIssue('pessoais', {}, HOJE)).toBeNull();
  });
});

describe('o que falta', () => {
  const whole = readClientRegistration(LEAD, HOJE);

  it('missingOf lista só o que tem rótulo e não está preenchido', () => {
    expect(missingOf(whole).map((m) => m.id)).toEqual(['rg', 'sexo', 'maritalStatus']);
  });

  it('o atalho do endereço e da emergência cai no primeiro campo vazio do grupo', () => {
    const item = (id) => missingOf({}).find((m) => m.id === id);
    expect(shortcutFieldOf(item('address'), {})).toBe('street');
    expect(shortcutFieldOf(item('address'), { street: 'Rua A', number: '10' })).toBe('city');
    expect(shortcutFieldOf(item('address'), { street: 'Rua A', city: 'Canoas' })).toBe('number');
    expect(shortcutFieldOf(item('emergency'), { emgName: 'Rafael' })).toBe('emgPhone');
    expect(shortcutFieldOf(item('rg'), {})).toBe('rg');
  });

  it('sectionStatus diz o que falta em cada seção', () => {
    expect(sectionStatus('identidade', whole)).toEqual({ ok: false, n: 2, text: 'Falta RG e sexo' });
    expect(sectionStatus('endereco', whole)).toEqual({ ok: true, n: 0, text: 'Completo' });
    expect(sectionStatus('emergencia', whole)).toEqual({ ok: true, n: 0, text: 'Completo' });
    expect(sectionStatus('pessoais', whole)).toEqual({ ok: false, n: 1, text: 'Falta estado civil' });
  });

  it('missingHeadline concorda no singular e no plural', () => {
    expect(missingHeadline(0)).toBe('Cadastro completo');
    expect(missingHeadline(1)).toBe('Falta 1 dado para completar o cadastro');
    expect(missingHeadline(4)).toBe('Faltam 4 dados para completar o cadastro');
  });

  it('o título só diz "completo" quando o anel está em 100%', () => {
    // Nome e WhatsApp contam no anel mas não têm atalho. Um menor de idade pode
    // ficar sem WhatsApp próprio, com o resto todo preenchido: o anel fica em 91%.
    const cheio = { ...whole, rg: '1', sexo: 'Feminino', maritalStatus: 'Casado(a)' };
    expect(isComplete(cheio)).toBe(true);
    expect(headlineOf(cheio)).toBe('Cadastro completo');
    const semZap = { ...cheio, whatsapp: '' };
    expect(isComplete(semZap)).toBe(false);
    expect(headlineOf(semZap)).toBe('Falta o WhatsApp para completar o cadastro');
    expect(headlineOf(whole)).toBe('Faltam 3 dados para completar o cadastro');
  });

  it('joinList junta com vírgula e "e"', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['CPF'])).toBe('CPF');
    expect(joinList(['CPF', 'RG'])).toBe('CPF e RG');
    expect(joinList(['CPF', 'RG', 'e-mail'])).toBe('CPF, RG e e-mail');
  });

  it('capFirst só maiúscula a primeira letra', () => {
    expect(capFirst('data de nascimento')).toBe('Data de nascimento');
    expect(capFirst('CPF')).toBe('CPF');
    expect(capFirst('')).toBe('');
  });
});

describe('ageOf', () => {
  it('conta os anos completos e respeita o aniversário', () => {
    expect(ageOf('1994-03-12', HOJE)).toBe(32);
    expect(ageOf('1994-03-12', new Date(2026, 2, 11))).toBe(31);
    expect(ageOf('1994-03-12', new Date(2026, 2, 12))).toBe(32);
  });
  it('data vazia, torta ou no futuro não tem idade', () => {
    expect(ageOf('', HOJE)).toBeNull();
    expect(ageOf('12/03/1994', HOJE)).toBeNull();
    expect(ageOf('2030-01-01', HOJE)).toBeNull();
  });
});

describe('viewRowsOf', () => {
  const whole = readClientRegistration(LEAD, HOJE);

  it('identidade mostra o nascimento com a idade e deixa o vazio como faltando', () => {
    const rows = viewRowsOf('identidade', whole, HOJE);
    expect(rows.map((r) => r.label)).toEqual(['Nome completo', 'WhatsApp', 'CPF', 'RG', 'Nascimento', 'Sexo', 'E-mail']);
    expect(rows.find((r) => r.key === 'birthDate').value).toBe('12/03/1994 (32 anos)');
    expect(rows.find((r) => r.key === 'rg').value).toBeNull();
    expect(rows.find((r) => r.key === 'rg').field).toBe('rg');
  });

  it('menor de idade ganha a linha do responsável', () => {
    const menor = { ...whole, isMinor: true, guardianName: 'Ana Costa', guardianRelation: 'Mãe', guardianPhone: '(11) 9 5555-4444' };
    const rows = viewRowsOf('identidade', menor, HOJE);
    expect(rows.find((r) => r.label === 'WhatsApp do aluno')).toBeTruthy();
    expect(rows.find((r) => r.key === 'guardianName').value).toBe('Ana Costa (Mãe) · (11) 9 5555-4444');
  });

  it('endereço preenchido mostra rua, bairro, cidade e CEP', () => {
    const rows = viewRowsOf('endereco', whole, HOJE);
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Rua', 'Rua Ramiro Barcelos, 1200, Apto 502'],
      ['Bairro', 'Santana'],
      ['Cidade', 'Porto Alegre, RS'],
      ['CEP', '90035-190'],
    ]);
  });

  it('endereço vazio é uma linha só, com o convite para adicionar', () => {
    const vazio = { ...whole, street: '', number: '', complement: '', neighborhood: '', city: '', state: '', cep: '' };
    expect(viewRowsOf('endereco', vazio, HOJE)).toEqual([
      { key: 'street', label: 'Endereço', value: null, field: 'street', addLabel: 'Adicionar endereço' },
    ]);
  });

  it('endereço parcial (a importação grava só a cidade) mostra as linhas, com Adicionar nas vazias', () => {
    const parcial = { ...whole, cep: '', street: '', number: '', complement: '', neighborhood: '', city: 'Canoas', state: '' };
    expect(viewRowsOf('endereco', parcial, HOJE)).toEqual([
      { key: 'street', label: 'Rua', value: null, field: 'street' },
      { key: 'neighborhood', label: 'Bairro', value: null, field: 'neighborhood' },
      { key: 'city', label: 'Cidade', value: 'Canoas', field: 'city' },
      { key: 'cep', label: 'CEP', value: null, field: 'cep' },
    ]);
    // O anel e o estado continuam pedindo rua, número e cidade.
    expect(sectionStatus('endereco', parcial)).toEqual({ ok: false, n: 1, text: 'Falta endereço' });
  });

  it('endereço só com o CEP também não é vazio', () => {
    const soCep = { ...whole, cep: '90035-190', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
    expect(viewRowsOf('endereco', soCep, HOJE).find((r) => r.key === 'cep').value).toBe('90035-190');
  });

  it('emergência sem nome mostra o telefone gravado', () => {
    const semNome = { ...whole, emgName: '', emgPhone: '(51) 9 8811-2200', emgRelation: '' };
    expect(viewRowsOf('emergencia', semNome, HOJE)).toEqual([
      { key: 'emgName', label: 'Nome', value: null, field: 'emgName' },
      { key: 'emgPhone', label: 'Telefone', value: '(51) 9 8811-2200', field: 'emgPhone' },
      { key: 'emgRelation', label: 'Parentesco', value: null, field: 'emgRelation' },
    ]);
  });

  it('emergência vazia convida a adicionar o contato', () => {
    const vazio = { ...whole, emgName: '', emgPhone: '', emgRelation: '' };
    const [linha] = viewRowsOf('emergencia', vazio, HOJE);
    expect(linha).toMatchObject({ label: 'Contato', value: null, field: 'emgName', addLabel: 'Adicionar contato' });
    expect(viewRowsOf('emergencia', whole, HOJE).map((r) => r.value)).toEqual(['Rafael', '(51) 9 8811-2200', 'Cônjuge']);
  });

  it('dados pessoais mostram estado civil e profissão', () => {
    expect(viewRowsOf('pessoais', whole, HOJE).map((r) => [r.label, r.value])).toEqual([
      ['Estado civil', null], ['Profissão', 'Fisioterapeuta'],
    ]);
  });
});
