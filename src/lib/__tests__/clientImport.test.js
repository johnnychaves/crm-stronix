// Regra pura da importação de clientes. Datas sempre em horário LOCAL.

import { describe, it, expect } from 'vitest';
import {
  normalizePhoneDigits,
  isValidCpf,
  normalizeCpfDigits,
  normalizeName,
  parseImportDate,
  normalizeSexo,
  isTruthyCell,
  contractSituationFromText,
  clientSituationFromText,
  CONTRACT_SITUATION,
  parseRow,
  isCandidateValid,
  dedupeInFile,
  distinctPlanNames,
  enrichCandidate,
  isInScope,
  resolveMatch,
  SCOPE,
  buildFillPatch,
  classifyCandidate,
  OUTCOME
} from '../clientImport.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const NOW = D(2026, 9, 3);

describe('normalizePhoneDigits', () => {
  it('tira o 55 do país e fica com DDD + número', () => {
    expect(normalizePhoneDigits('5571999998888')).toBe('71999998888');
    expect(normalizePhoneDigits('+55 (71) 99999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('557133334444')).toBe('7133334444');
  });

  it('aceita máscara, espaço e fixo de 10 dígitos', () => {
    expect(normalizePhoneDigits('(71) 9 9999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('71 3333-4444')).toBe('7133334444');
  });

  it('fora de 10 ou 11 dígitos não casa', () => {
    expect(normalizePhoneDigits('99998888')).toBeNull();
    expect(normalizePhoneDigits('')).toBeNull();
    expect(normalizePhoneDigits(null)).toBeNull();
    expect(normalizePhoneDigits('123456789012345')).toBeNull();
  });

  it('tira o 0 de tronco legado (0xx DDD)', () => {
    expect(normalizePhoneDigits('(0xx71) 3333-4444')).toBe('7133334444');
    expect(normalizePhoneDigits('(0xx71) 99999-8888')).toBe('71999998888');
    expect(normalizePhoneDigits('0 55 3333-4444')).toBe('5533334444');
    expect(normalizePhoneDigits('55 0 71 99999-8888')).toBe('71999998888');
  });
});

describe('isValidCpf / normalizeCpfDigits', () => {
  it('valida pelo dígito verificador', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('12345678909')).toBe(true);
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('rejeita sequência repetida e tamanho errado', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
  });

  it('normaliza com máscara e sinaliza inválido sem barrar', () => {
    expect(normalizeCpfDigits('529.982.247-25')).toEqual({ digits: '52998224725', invalid: false });
    expect(normalizeCpfDigits('000.000.000-00')).toEqual({ digits: null, invalid: true });
    expect(normalizeCpfDigits('')).toEqual({ digits: null, invalid: false });
    expect(normalizeCpfDigits(undefined)).toEqual({ digits: null, invalid: false });
    expect(normalizeCpfDigits(1234567890)).toEqual({ digits: '01234567890', invalid: false });
  });
});

describe('normalizeName', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizeName('  João   da SILVA ')).toBe('joao da silva');
    expect(normalizeName(null)).toBe('');
  });
});

describe('parseImportDate', () => {
  it('dd/mm/aaaa, com e sem hora', () => {
    expect(parseImportDate('12/11/2026', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('12/11/2026 00:00:00', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('5/3/1985', NOW)).toEqual(D(1985, 3, 5));
  });

  it('dd/mm/aa com pivô: até ano atual + 10 é 20xx, acima é 19xx', () => {
    expect(parseImportDate('12/11/26', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('01/01/36', NOW)).toEqual(D(2036, 1, 1));
    expect(parseImportDate('05/03/85', NOW)).toEqual(D(1985, 3, 5));
    expect(parseImportDate('01/01/37', NOW)).toEqual(D(1937, 1, 1));
  });

  it('aaaa-mm-dd, com e sem hora', () => {
    expect(parseImportDate('2026-11-12', NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate('2026-11-12T00:00:00', NOW)).toEqual(D(2026, 11, 12));
  });

  it('serial do Excel e Date do SheetJS viram meia-noite local', () => {
    expect(parseImportDate(46338, NOW)).toEqual(D(2026, 11, 12));
    expect(parseImportDate(new Date(2026, 10, 12, 15, 30), NOW)).toEqual(D(2026, 11, 12));
  });

  it('vazio, ambíguo ou impossível é null', () => {
    expect(parseImportDate('', NOW)).toBeNull();
    expect(parseImportDate(null, NOW)).toBeNull();
    expect(parseImportDate('novembro', NOW)).toBeNull();
    expect(parseImportDate('31/02/2026', NOW)).toBeNull();
    expect(parseImportDate('12-11-2026', NOW)).toBeNull();
    expect(parseImportDate(0, NOW)).toBeNull();
    expect(parseImportDate(new Date('x'), NOW)).toBeNull();
  });
});

describe('normalizeSexo', () => {
  it('mapeia para os valores do app', () => {
    expect(normalizeSexo('M')).toBe('Masculino');
    expect(normalizeSexo('masculino')).toBe('Masculino');
    expect(normalizeSexo('F')).toBe('Feminino');
    expect(normalizeSexo('FEMININO')).toBe('Feminino');
    expect(normalizeSexo('Outro')).toBe('Outro');
    expect(normalizeSexo('')).toBeNull();
    expect(normalizeSexo('Não informado')).toBe('Não informado');
  });
});

describe('isTruthyCell', () => {
  it('reconhece sim/x/1/true/vip', () => {
    ['Sim', 'S', 'x', 'X', '1', 'true', 'VIP', 'yes'].forEach((v) => expect(isTruthyCell(v)).toBe(true));
    expect(isTruthyCell(1)).toBe(true);
    expect(isTruthyCell(true)).toBe(true);
  });
  it('não/vazio/0 é falso', () => {
    ['Não', 'N', '', '0', 'false'].forEach((v) => expect(isTruthyCell(v)).toBe(false));
    expect(isTruthyCell(0)).toBe(false);
    expect(isTruthyCell(undefined)).toBe(false);
  });
});

describe('contractSituationFromText', () => {
  it('mapeia os textos usuais', () => {
    expect(contractSituationFromText('Ativo')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('ATIVO')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('Vencido')).toBe(CONTRACT_SITUATION.VENCIDO);
    expect(contractSituationFromText('Inativo')).toBe(CONTRACT_SITUATION.VENCIDO);
    expect(contractSituationFromText('A vencer')).toBe(CONTRACT_SITUATION.A_VENCER);
    expect(contractSituationFromText('Cancelado')).toBe(CONTRACT_SITUATION.CANCELADO);
    expect(contractSituationFromText('Trancado')).toBe(CONTRACT_SITUATION.TRANCADO);
    expect(contractSituationFromText('Pré-cancelado')).toBe(CONTRACT_SITUATION.ATIVO);
    expect(contractSituationFromText('Suspenso')).toBe(CONTRACT_SITUATION.TRANCADO);
  });
  it('vazio é null e texto estranho é desconhecido', () => {
    expect(contractSituationFromText('')).toBeNull();
    expect(contractSituationFromText(undefined)).toBeNull();
    expect(contractSituationFromText('Xyz')).toBe(CONTRACT_SITUATION.DESCONHECIDO);
  });
});

describe('clientSituationFromText', () => {
  it('ativo / inativo / null', () => {
    expect(clientSituationFromText('Ativo')).toBe('ativo');
    expect(clientSituationFromText('Inativo')).toBe('inativo');
    expect(clientSituationFromText('Bloqueado')).toBe('inativo');
    expect(clientSituationFromText('')).toBeNull();
    expect(clientSituationFromText('Xyz')).toBeNull();
  });
});

const NEXTFIT_MAPPING = {
  name: 'Nome', email: 'E-mail', planName: 'Contrato', whatsapp: 'Telefone',
  contractSituation: 'Situação do contrato', clientSituation: 'Situação do cliente',
  cpf: 'CPF', rg: 'RG', birthDate: 'Data de nascimento', registeredAt: 'Data de cadastro',
  dor: 'Objetivo', sexo: 'Sexo', vip: 'VIP', addrStreet: 'Endereco', addrNumber: 'Número',
  addrNeighborhood: 'Bairro', addrCep: 'Cep', addrCity: 'Cidade', addrComplement: 'Complemento',
  consultantName: 'Consultor', professorName: 'Professor',
  contractStartsAt: null, contractEndsAt: null, contractValue: null
};

const nextfitRow = (over = {}) => ({
  __row: 2,
  'Nome': ' Ana  Teste ', 'E-mail': 'ana@example.com', 'Contrato': 'Trimestral', 'Telefone': '(71) 99999-0001',
  'Situação do contrato': 'Ativo', 'Situação do cliente': 'Ativo', 'CPF': '529.982.247-25', 'RG': '123',
  'Data de nascimento': '05/03/1985', 'Data de cadastro': '10/01/2026', 'Objetivo': 'Emagrecer', 'Sexo': 'F',
  'VIP': 'Não', 'Endereco': 'Rua A', 'Número': '10', 'Bairro': 'Centro', 'Cep': '40000-000', 'Cidade': 'Salvador',
  'Complemento': '', 'Consultor': 'Bia', 'Professor': 'Carlos',
  ...over
});

describe('parseRow', () => {
  it('monta o candidato a partir do mapeamento', () => {
    const c = parseRow(nextfitRow(), NEXTFIT_MAPPING, 2, NOW);
    expect(c.rowNumber).toBe(2);
    expect(c.name).toBe('Ana Teste');
    expect(c.nameLower).toBe('ana teste');
    expect(c.email).toBe('ana@example.com');
    expect(c.whatsappRaw).toBe('(71) 99999-0001');
    expect(c.whatsappDigits).toBe('71999990001');
    expect(c.cpfDigits).toBe('52998224725');
    expect(c.cpfInvalid).toBe(false);
    expect(c.rg).toBe('123');
    expect(c.birthDate).toEqual(D(1985, 3, 5));
    expect(c.registeredAt).toEqual(D(2026, 1, 10));
    expect(c.sexo).toBe('Feminino');
    expect(c.dor).toBe('Emagrecer');
    expect(c.vip).toBe(false);
    expect(c.address).toEqual({ cep: '40000-000', street: 'Rua A', number: '10', complement: '', neighborhood: 'Centro', city: 'Salvador', state: '' });
    expect(c.consultantName).toBe('Bia');
    expect(c.professorName).toBe('Carlos');
    expect(c.planName).toBe('Trimestral');
    expect(c.contractSituation).toBe('ativo');
    expect(c.clientSituation).toBe('ativo');
    expect(c.startsAt).toBeNull();
    expect(c.endsAt).toBeNull();
    expect(c.value).toBeNull();
    expect(c.warnings).toEqual([]);
  });

  it('campo sem coluna mapeada fica nulo; endereço todo vazio é null', () => {
    const c = parseRow({ __row: 5, 'Nome': 'Bruno', 'CPF': '111.444.777-35' }, { ...NEXTFIT_MAPPING, addrStreet: null, addrNumber: null, addrNeighborhood: null, addrCep: null, addrCity: null, addrComplement: null }, 5, NOW);
    expect(c.email).toBeNull();
    expect(c.whatsappDigits).toBeNull();
    expect(c.address).toBeNull();
    expect(c.contractSituation).toBeNull();
    expect(c.clientSituation).toBeNull();
  });

  it('CPF inválido vira aviso e não trava; data de fim ilegível vira aviso', () => {
    const c = parseRow(nextfitRow({ 'CPF': '000.000.000-00', 'Fim': 'amanhã' }), { ...NEXTFIT_MAPPING, contractEndsAt: 'Fim' }, 2, NOW);
    expect(c.cpfDigits).toBeNull();
    expect(c.cpfInvalid).toBe(true);
    expect(c.endsAt).toBeNull();
    expect(c.warnings).toEqual(['CPF inválido', 'Data de fim ilegível']);
  });

  it('lê datas e valor do contrato quando mapeados', () => {
    const c = parseRow(
      { __row: 3, 'Nome': 'Ana', 'CPF': '529.982.247-25', 'Início': '12/08/2026', 'Fim': '12/11/2026', 'Valor': 'R$ 450,00' },
      { ...NEXTFIT_MAPPING, contractStartsAt: 'Início', contractEndsAt: 'Fim', contractValue: 'Valor' }, 3, NOW
    );
    expect(c.startsAt).toEqual(D(2026, 8, 12));
    expect(c.endsAt).toEqual(D(2026, 11, 12));
    expect(c.value).toBe(450);
  });

  it('CEP numérico recupera o zero à esquerda', () => {
    const c = parseRow(nextfitRow({ 'Cep': 4567000 }), NEXTFIT_MAPPING, 2, NOW);
    expect(c.address.cep).toBe('04567000');
  });
});

describe('isCandidateValid', () => {
  it('precisa de nome e de CPF válido ou telefone válido', () => {
    expect(isCandidateValid({ name: 'Ana', cpfDigits: '52998224725', whatsappDigits: null })).toBe(true);
    expect(isCandidateValid({ name: 'Ana', cpfDigits: null, whatsappDigits: '71999990001' })).toBe(true);
    expect(isCandidateValid({ name: 'Ana', cpfDigits: null, whatsappDigits: null })).toBe(false);
    expect(isCandidateValid({ name: 'A', cpfDigits: '52998224725', whatsappDigits: null })).toBe(false);
    expect(isCandidateValid({ name: '', cpfDigits: '52998224725', whatsappDigits: '71999990001' })).toBe(false);
  });
});

describe('dedupeInFile', () => {
  const base = { name: 'Ana', cpfDigits: '52998224725', whatsappDigits: '71999990001', endsAt: null };
  it('mesmo CPF: fica a de fim mais recente, a outra recebe duplicateOf', () => {
    const { kept, duplicates } = dedupeInFile([
      { ...base, rowNumber: 2, endsAt: D(2026, 10, 1) },
      { ...base, rowNumber: 3, endsAt: D(2026, 11, 12) },
      { ...base, rowNumber: 4, endsAt: null }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([3]);
    expect(duplicates.map((c) => [c.rowNumber, c.duplicateOf])).toEqual([[2, 3], [4, 3]]);
  });

  it('sem CPF casa pelo telefone; sem os dois nunca é duplicata', () => {
    const { kept, duplicates } = dedupeInFile([
      { name: 'Bruno', rowNumber: 2, cpfDigits: null, whatsappDigits: '71999990002', endsAt: null },
      { name: 'Bruno', rowNumber: 3, cpfDigits: null, whatsappDigits: '71999990002', endsAt: null },
      { name: 'Sem nada', rowNumber: 4, cpfDigits: null, whatsappDigits: null, endsAt: null },
      { name: 'Sem nada', rowNumber: 5, cpfDigits: null, whatsappDigits: null, endsAt: null }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([2, 4, 5]);
    expect(duplicates.map((c) => c.rowNumber)).toEqual([3]);
  });

  it('empate de fim fica com a primeira linha', () => {
    const { kept } = dedupeInFile([
      { ...base, rowNumber: 2, endsAt: D(2026, 11, 12) },
      { ...base, rowNumber: 3, endsAt: D(2026, 11, 12) }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([2]);
  });

  it('linha válida vence a inválida mesmo com fim mais antigo', () => {
    const { kept, duplicates } = dedupeInFile([
      { name: '', rowNumber: 2, cpfDigits: '52998224725', whatsappDigits: null, endsAt: D(2026, 11, 12) },
      { name: 'Ana', rowNumber: 3, cpfDigits: '52998224725', whatsappDigits: null, endsAt: D(2026, 10, 1) }
    ]);
    expect(kept.map((c) => c.rowNumber)).toEqual([3]);
    expect(duplicates.map((c) => [c.rowNumber, c.duplicateOf])).toEqual([[2, 3]]);
  });
});

describe('distinctPlanNames', () => {
  it('agrupa por nome normalizado com contagem, na ordem de frequência', () => {
    const out = distinctPlanNames([
      { planName: 'Trimestral' }, { planName: 'TRIMESTRAL ' }, { planName: 'Mensal' }, { planName: null }, { planName: '' }
    ]);
    expect(out).toEqual([{ key: 'trimestral', label: 'Trimestral', count: 2 }, { key: 'mensal', label: 'Mensal', count: 1 }]);
  });
});

const USERS = [{ id: 'u1', name: 'Bia Souza', authUid: 'a1' }, { id: 'u2', name: 'Caio', authUid: 'a2' }];
const PROFS = [{ id: 'p1', name: 'Carlos Lima' }];
const PLANOS = [
  { id: 'pl1', name: 'Trimestral', durationMonths: 3, value: 450 },
  { id: 'pl2', name: 'Mensal', durationMonths: 1, value: 150 }
];

describe('enrichCandidate', () => {
  it('casa consultor, professor e plano por nome normalizado', () => {
    const c = enrichCandidate({ consultantName: 'bia souza', professorName: 'CARLOS LIMA', planName: 'trimestral' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: {} });
    expect(c.consultant).toBe(USERS[0]);
    expect(c.professorId).toBe('p1');
    expect(c.professorName).toBe('Carlos Lima');
    expect(c.plan).toBe(PLANOS[0]);
  });

  it('sem correspondência: consultor null, professorId null (mantém o texto), plano null', () => {
    const c = enrichCandidate({ consultantName: 'Zé', professorName: 'Ninguém', planName: 'Plano Ouro' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: {} });
    expect(c.consultant).toBeNull();
    expect(c.professorId).toBeNull();
    expect(c.professorName).toBe('Ninguém');
    expect(c.plan).toBeNull();
  });

  it('o mapeamento manual de plano vence o nome; __text__ força texto', () => {
    const byMap = enrichCandidate({ planName: 'Plano Ouro' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: { 'plano ouro': 'pl2' } });
    expect(byMap.plan).toBe(PLANOS[1]);
    const forcedText = enrichCandidate({ planName: 'Trimestral' }, { usersList: USERS, professores: PROFS, planos: PLANOS, planMap: { trimestral: '__text__' } });
    expect(forcedText.plan).toBeNull();
  });
});

describe('isInScope', () => {
  const W = 15;
  const c = (over) => ({ contractSituation: 'ativo', clientSituation: 'ativo', startsAt: null, endsAt: null, ...over });

  it('com data de fim o relógio decide: vigente entra, vencido só dentro da janela', () => {
    expect(isInScope(c({ endsAt: D(2026, 11, 12) }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 25), contractSituation: 'vencido' }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 19) }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 18) }), SCOPE.PADRAO, NOW, W)).toBe(false);
    expect(isInScope(c({ endsAt: D(2026, 7, 1), contractSituation: 'ativo' }), SCOPE.PADRAO, NOW, W)).toBe(false);
  });

  it('cancelado fica fora; trancado entra mesmo com fim no passado', () => {
    expect(isInScope(c({ endsAt: D(2027, 1, 1), contractSituation: 'cancelado' }), SCOPE.PADRAO, NOW, W)).toBe(false);
    expect(isInScope(c({ endsAt: D(2026, 1, 1), contractSituation: 'trancado' }), SCOPE.PADRAO, NOW, W)).toBe(true);
  });

  it('sem data de fim manda a situação do cliente', () => {
    expect(isInScope(c({ clientSituation: 'ativo' }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ clientSituation: null }), SCOPE.PADRAO, NOW, W)).toBe(true);
    expect(isInScope(c({ clientSituation: 'inativo' }), SCOPE.PADRAO, NOW, W)).toBe(false);
  });

  it('escopo "todos" aceita tudo', () => {
    expect(isInScope(c({ endsAt: D(2020, 1, 1) }), SCOPE.TODOS, NOW, W)).toBe(true);
    expect(isInScope(c({ contractSituation: 'cancelado' }), SCOPE.TODOS, NOW, W)).toBe(true);
    expect(isInScope(c({ clientSituation: 'inativo' }), SCOPE.TODOS, NOW, W)).toBe(true);
  });

  it('a hora do dia não muda o limite da janela', () => {
    const late = new Date(2026, 8, 3, 23, 0);
    expect(isInScope(c({ endsAt: D(2026, 8, 19) }), SCOPE.PADRAO, late, W)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 8, 18) }), SCOPE.PADRAO, late, W)).toBe(false);
  });

  it('janela 0 aceita só quem venceu hoje; windowDays ausente usa o padrão', () => {
    const midday = new Date(2026, 8, 3, 12, 0);
    expect(isInScope(c({ endsAt: D(2026, 9, 3) }), SCOPE.PADRAO, midday, 0)).toBe(true);
    expect(isInScope(c({ endsAt: D(2026, 9, 2) }), SCOPE.PADRAO, midday, 0)).toBe(false);
    expect(isInScope(c({ endsAt: D(2026, 8, 25) }), SCOPE.PADRAO, midday, undefined)).toBe(true);
  });

  it('matrícula agendada (início no futuro) entra', () => {
    expect(isInScope(c({ startsAt: D(2026, 10, 1), endsAt: D(2027, 1, 1) }), SCOPE.PADRAO, NOW, W)).toBe(true);
  });
});

describe('resolveMatch', () => {
  const ana = { id: 'L1', name: 'Ana', cpfDigits: '52998224725', whatsappDigits: '71999990001' };
  const bruno = { id: 'L2', name: 'Bruno', cpfDigits: '', whatsappDigits: '71999990002' };
  const homonimo = { id: 'L3', name: 'Ana', cpfDigits: '', whatsappDigits: '' };
  const index = { byCpf: new Map([['52998224725', ana]]), byPhone: new Map([['71999990002', bruno]]), byName: new Map([['ana', [homonimo]]]) };

  it('CPF antes de telefone, telefone antes de nome', () => {
    expect(resolveMatch({ cpfDigits: '52998224725', whatsappDigits: '71999990002', nameLower: 'ana' }, index)).toEqual({ kind: 'cpf', lead: ana, homonyms: [] });
    expect(resolveMatch({ cpfDigits: null, whatsappDigits: '71999990002', nameLower: 'ana' }, index)).toEqual({ kind: 'phone', lead: bruno, homonyms: [] });
    expect(resolveMatch({ cpfDigits: '11144477735', whatsappDigits: '71999990009', nameLower: 'ana' }, index)).toEqual({ kind: 'name', lead: null, homonyms: [homonimo] });
    expect(resolveMatch({ cpfDigits: null, whatsappDigits: null, nameLower: 'ninguem' }, index)).toEqual({ kind: 'none', lead: null, homonyms: [] });
  });
});

const VALID = { name: 'Ana Teste', nameLower: 'ana teste', cpfDigits: '52998224725', whatsappDigits: '71999990001', email: 'ana@example.com', rg: null, birthDate: null, sexo: null, dor: null, vip: false, address: null, professorId: null, professorName: null, contractSituation: 'ativo', clientSituation: 'ativo', startsAt: null, endsAt: null, warnings: [] };
const OPTS = { decision: undefined, scope: SCOPE.PADRAO, now: NOW, windowDays: 15 };
const NONE = { kind: 'none', lead: null, homonyms: [] };

describe('buildFillPatch', () => {
  it('preenche só o que está vazio e recomputa os campos de busca quando toca telefone ou CPF', () => {
    const lead = { name: 'Ana', whatsapp: '', email: 'ja@tem.com', cpf: null, tags: [] };
    const patch = buildFillPatch({ ...VALID, vip: true, rg: '12', sexo: 'Feminino', dor: 'Emagrecer', address: { street: 'Rua A' }, professorId: 'p1', professorName: 'Carlos' }, lead);
    expect(patch.whatsapp).toBe('(71) 9 9999-0001');
    expect(patch.email).toBeUndefined();
    expect(patch.cpf).toBe('529.982.247-25');
    expect(patch.rg).toBe('12');
    expect(patch.sexo).toBe('Feminino');
    expect(patch.dor).toBe('Emagrecer');
    expect(patch.address).toEqual({ street: 'Rua A' });
    expect(patch.professorId).toBe('p1');
    expect(patch.professorName).toBe('Carlos');
    expect(patch.tags).toEqual(['VIP']);
    expect(patch.whatsappDigits).toBe('71999990001');
    expect(patch.cpfDigits).toBe('52998224725');
    expect(patch.nameLower).toBe('ana');
  });

  it('nada vazio, nada no patch; VIP já presente não repete', () => {
    const lead = { name: 'Ana', whatsapp: '(71) 9 9999-0001', email: 'x@y.com', cpf: '529.982.247-25', rg: '1', birthDate: D(1985, 3, 5), sexo: 'Feminino', dor: 'x', address: { street: 'r' }, professorId: 'p9', tags: ['VIP'] };
    expect(buildFillPatch({ ...VALID, vip: true, rg: '2', professorId: 'p1' }, lead)).toEqual({});
  });
});

describe('classifyCandidate', () => {
  it('duplicada no arquivo, inválida e fora do escopo, nessa ordem', () => {
    expect(classifyCandidate({ ...VALID, duplicateOf: 2 }, NONE, OPTS).outcome).toBe(OUTCOME.DUPLICADA);
    expect(classifyCandidate({ ...VALID, cpfDigits: null, whatsappDigits: null }, NONE, OPTS).outcome).toBe(OUTCOME.INVALIDA);
    expect(classifyCandidate({ ...VALID, name: '' }, NONE, OPTS).reason).toBe('Sem nome');
    expect(classifyCandidate({ ...VALID, clientSituation: 'inativo' }, NONE, OPTS).outcome).toBe(OUTCOME.FORA_DO_ESCOPO);
  });

  it('sem casamento cria; com fim cria com contrato', () => {
    const semFim = classifyCandidate(VALID, NONE, OPTS);
    expect(semFim.outcome).toBe(OUTCOME.CRIAR);
    expect(semFim.createContract).toBe(false);
    const comFim = classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, NONE, OPTS);
    expect(comFim.createContract).toBe(true);
  });

  it('suspeita por nome espera decisão; "create" cria; id de homônimo usa o existente', () => {
    const homonimo = { id: 'L3', name: 'Ana Teste', status: 'Novo', cpfDigits: '', whatsappDigits: '' };
    const match = { kind: 'name', lead: null, homonyms: [homonimo] };
    expect(classifyCandidate(VALID, match, OPTS).outcome).toBe(OUTCOME.SUSPEITA);
    expect(classifyCandidate(VALID, match, { ...OPTS, decision: 'create' }).outcome).toBe(OUTCOME.CRIAR);
    const usa = classifyCandidate(VALID, match, { ...OPTS, decision: 'L3' });
    expect(usa.outcome).toBe(OUTCOME.PROMOVER);
    expect(usa.lead).toBe(homonimo);
  });

  it('casado por telefone com CPF diferente é conflito', () => {
    const lead = { id: 'L2', name: 'Bruno', cpfDigits: '11144477735', whatsappDigits: '71999990001', status: 'Novo' };
    const r = classifyCandidate(VALID, { kind: 'phone', lead, homonyms: [] }, OPTS);
    expect(r.outcome).toBe(OUTCOME.CONFLITO);
    expect(r.reason).toMatch(/CPF diferente/);
  });

  it('já tem contrato com fim diferente é conflito; com o mesmo dia não é', () => {
    const cliente = { id: 'L1', name: 'Ana', lifecycleStage: 'cliente', status: 'Venda', isConverted: true, currentContractId: 'C1', currentContractEndsAt: D(2026, 10, 1), cpfDigits: '52998224725' };
    const m = { kind: 'cpf', lead: cliente, homonyms: [] };
    expect(classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, m, OPTS).outcome).toBe(OUTCOME.CONFLITO);
    const mesmo = classifyCandidate({ ...VALID, endsAt: new Date(2026, 9, 1, 15, 0) }, m, OPTS);
    expect(mesmo.outcome).not.toBe(OUTCOME.CONFLITO);
    expect(mesmo.createContract).toBe(false);
  });

  it('lead em prospecção ou em perda vira promover (com ou sem contrato)', () => {
    const lead = { id: 'L1', name: 'Ana', status: 'Negociando', cpfDigits: '52998224725', email: 'ana@example.com' };
    const semFim = classifyCandidate(VALID, { kind: 'cpf', lead, homonyms: [] }, OPTS);
    expect(semFim.outcome).toBe(OUTCOME.PROMOVER);
    expect(semFim.createContract).toBe(false);
    const perda = classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, { kind: 'cpf', lead: { ...lead, status: 'Perda' }, homonyms: [] }, OPTS);
    expect(perda.outcome).toBe(OUTCOME.PROMOVER);
    expect(perda.createContract).toBe(true);
  });

  it('cliente sem contrato + fim = registrar contrato; cliente completo = atualizar ou sem alteração', () => {
    const cliente = { id: 'L1', name: 'Ana', lifecycleStage: 'cliente', status: 'Venda', isConverted: true, cpfDigits: '52998224725', email: null, whatsapp: '(71) 9 9999-0001', cpf: '529.982.247-25' };
    const m = { kind: 'cpf', lead: cliente, homonyms: [] };
    expect(classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, m, OPTS).outcome).toBe(OUTCOME.REGISTRAR_CONTRATO);
    const atualiza = classifyCandidate(VALID, m, OPTS);
    expect(atualiza.outcome).toBe(OUTCOME.ATUALIZAR);
    expect(atualiza.fill).toEqual({ email: 'ana@example.com' });
    const completo = { ...cliente, email: 'ana@example.com', currentContractId: 'C1', currentContractEndsAt: D(2026, 11, 12) };
    expect(classifyCandidate({ ...VALID, endsAt: D(2026, 11, 12) }, { kind: 'cpf', lead: completo, homonyms: [] }, OPTS).outcome).toBe(OUTCOME.SEM_ALTERACAO);
  });
});
